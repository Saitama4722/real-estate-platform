"use client";

/**
 * Счётчики непрочитанного для колокольчика в шапке, бокового меню кабинета и
 * точек в строках списков. ОДИН источник на всё приложение.
 *
 * ⭐ ОДИН ОПРОС НА ВСЁ ПРИЛОЖЕНИЕ. Это модульный синглтон поверх
 * `useSyncExternalStore`, а НЕ React-контекст: колокольчик (`HeaderNotificationsBell`,
 * корневой layout) и счётчики бокового меню (`AccountSidebar`, внутри
 * `/account/(cabinet)`) живут в РАЗНЫХ поддеревьях. Синглтон обновляет ровно
 * тех, кто подписан.
 *
 * ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ ЗАКРЕПЛЕНЫ:
 *
 * 1. **Опрос, а не WebSocket** — у проекта нет ASGI-сервера (решение
 *    владельца). Интервал **15 секунд** (2026-10-18, было 30): плюс немедленный
 *    запрос на возврат во вкладку, на фокус окна и после любого действия
 *    (взять / вернуть / прочитать / скрыть) — `refreshCrmUnreadCounts()`.
 * 2. **Скрытая вкладка не опрашивается.** Таймер снимается на
 *    `visibilitychange` и возвращается вместе с НЕМЕДЛЕННЫМ запросом.
 * 3. **Неудачный опрос МОЛЧИТ.** Сеть моргнула — ждём следующего интервала.
 * 4. **Запрошенное обновление не теряется.** Если опрос уже в полёте,
 *    `refreshCrmUnreadCounts()` ставит повтор сразу после него (раньше вызов
 *    просто отбрасывался, и бейдж мог висеть до следующего интервала).
 * 5. **Звук — по «последнему прозвоненному id»** (2026-10-18, заменило
 *    «никогда при загрузке»). Ручка отдаёт `latest_notification_id` — самое
 *    свежее НЕПРОЧИТАННОЕ уведомление за 24 часа. В localStorage (ключ на
 *    пользователя) лежит id, для которого уже звучали. Звук ⇔ `latest >
 *    lastChimed`, затем `lastChimed = latest`: один сигнал за то, что пришло
 *    без риэлтора, один на каждое новое, тишина на перезагрузке и переходах.
 * 6. **Одно событие для списков.** Любое изменение счётчиков (опрос нашёл
 *    новое, оптимистичное «прочитано») рассылает `CRM_READ_STATE_EVENT`;
 *    таблицы заявок перечитывают строки по нему — так точки в строках гаснут
 *    и зажигаются синхронно с колокольчиком и боковым меню.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { playCrmNotifySound } from "@/lib/crmInquiryNotifySound";

export type CrmUnreadCounts = {
  inquiries: number;
  sale_requests: number;
  total: number;
  /** Непрочитанные уведомления колокольчика за 24 часа. */
  notifications: number;
  /** id самого свежего из них, 0 — нет ни одного. По нему решается звук. */
  latest_notification_id: number;
};

/** 15 секунд — согласованный интервал. Меняя его, поменяйте и CLAUDE.md. */
export const CRM_POLL_INTERVAL_MS = 15_000;

/** Событие на window: «состояние прочтения поменялось — перечитайте строки». */
export const CRM_READ_STATE_EVENT = "centreal:crm-read-state";

const LAST_CHIMED_LS_PREFIX = "centreal_crm_last_chimed_notification:";

function readLastChimed(uid: number): number {
  try {
    const v = Number(window.localStorage.getItem(LAST_CHIMED_LS_PREFIX + uid));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeLastChimed(uid: number, id: number): void {
  try {
    window.localStorage.setItem(LAST_CHIMED_LS_PREFIX + uid, String(id));
  } catch {
    /* приватный режим / квота — максимум прозвоним ещё раз, ничего не ломаем */
  }
}

/** `null` = ещё не знаем. Именно `null`, а не нули: «пока неизвестно» и
    «непрочитанного нет» — разные состояния, и рисовать по ним надо разное. */
let counts: CrmUnreadCounts | null = null;
let soundEnabled = true;
/** Индикатор положен только риэлтору — сюда это приходит из /api/auth/me/. */
let enabled = false;
/** Чей это опрос: ключ «последнего прозвоненного id» — на пользователя. */
let userId: number | null = null;

let timerId: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
/** Обновление попросили, пока запрос был в полёте — повторить сразу после. */
let pending = false;
/**
 * Поколение оптимистичных правок. Ответ опроса, ушедшего ДО последней правки,
 * устарел: сервер мог ответить раньше, чем применил действие, и вернул бы
 * бейдж назад (`[measured]`: бейдж бокового меню «отскакивал» после массового
 * «прочитано»). Такой ответ выбрасывается и запрос повторяется.
 */
let generation = 0;
let windowBound = false;

const listeners = new Set<() => void>();

/** Ссылочно стабильный снимок: `useSyncExternalStore` сравнивает по `Object.is`. */
let snapshot: { counts: CrmUnreadCounts | null; soundEnabled: boolean; enabled: boolean } = {
  counts: null,
  soundEnabled: true,
  enabled: false,
};

function emitReadStateChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(CRM_READ_STATE_EVENT));
  } catch {
    /* очень старый браузер — списки просто обновятся своим опросом */
  }
}

function publish(): void {
  snapshot = { counts, soundEnabled, enabled };
  for (const l of listeners) l();
}

function sameCounts(a: CrmUnreadCounts | null, b: CrmUnreadCounts | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.inquiries === b.inquiries &&
    a.sale_requests === b.sale_requests &&
    a.total === b.total &&
    a.notifications === b.notifications &&
    a.latest_notification_id === b.latest_notification_id
  );
}

function parseCounts(raw: unknown): CrmUnreadCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  const inquiries = n(o.inquiries);
  const sale_requests = n(o.sale_requests);
  if (inquiries === null || sale_requests === null) return null;
  const total = n(o.total);
  return {
    inquiries,
    sale_requests,
    total: total === null ? inquiries + sale_requests : total,
    notifications: n(o.notifications) ?? 0,
    latest_notification_id: n(o.latest_notification_id) ?? 0,
  };
}

async function fetchCounts(): Promise<void> {
  if (!enabled) return;
  if (inFlight) {
    pending = true;
    return;
  }
  if (!getCrmAccessToken()) return;
  inFlight = true;
  const startedAt = generation;
  try {
    const res = await fetchWithCrmAuthRetry("/api/crm/notifications/unread-counts/", {
      cache: "no-store",
    });
    if (!res.ok) return; // тихо: 401/403/500 — просто ждём следующего интервала
    const next = parseCounts(await res.json());
    if (!next) return;
    if (startedAt !== generation) {
      pending = true; // устаревший ответ — см. `generation`
      return;
    }

    /* Звук — правило 5. id записываем ВСЕГДА, даже при выключенном звуке:
       иначе включение звука прозвенело бы за давно пришедшее уведомление. */
    let chime = false;
    if (userId !== null && next.latest_notification_id > 0) {
      if (next.latest_notification_id > readLastChimed(userId)) {
        writeLastChimed(userId, next.latest_notification_id);
        chime = true;
      }
    }

    const changed = !sameCounts(counts, next);
    counts = next;
    if (changed) {
      publish();
      emitReadStateChanged();
    }
    if (chime && soundEnabled) playCrmNotifySound();
  } catch {
    /* Молча. Правило 3. */
  } finally {
    inFlight = false;
    if (pending) {
      pending = false;
      void fetchCounts();
    }
  }
}

function startTimer(): void {
  if (timerId !== null || !enabled) return;
  if (typeof document !== "undefined" && document.hidden) return;
  timerId = setInterval(() => {
    void fetchCounts();
  }, CRM_POLL_INTERVAL_MS);
}

function stopTimer(): void {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
}

function onVisibilityChange(): void {
  if (document.hidden) {
    stopTimer();
    return;
  }
  startTimer();
  void fetchCounts(); // вкладку вернули — не заставляем ждать интервал
}

function onFocus(): void {
  // Окно получило фокус (переключились из другого приложения, вкладка уже
  // была видима) — тоже повод не ждать до 15 секунд.
  if (listeners.size > 0) void fetchCounts();
}

function bindWindow(): void {
  if (windowBound || typeof window === "undefined") return;
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onFocus);
  windowBound = true;
}

function reset(): void {
  stopTimer();
  counts = null;
  publish();
}

/**
 * Сообщить хранилищу, кто сейчас вошёл. Зовут и шапка, и боковое меню — обе
 * уже держат ответ `/api/auth/me/`. Идемпотентно.
 *
 * ⚠ `userId: undefined` = «не знаю, оставь как есть». (Раньше боковое меню
 * не передавало id, и шапка с меню по очереди переключали пользователя
 * хранилища между настоящим id и null — каждый раз сбрасывая счётчики и
 * удваивая опрос: `[measured]` два запроса в одну и ту же секунду.)
 */
export function configureCrmUnread(opts: {
  isRealtor: boolean;
  soundEnabled?: boolean;
  userId?: number | null;
}): void {
  const nextSound = opts.soundEnabled ?? soundEnabled;
  const soundChanged = nextSound !== soundEnabled;
  soundEnabled = nextSound;
  const nextUser = !opts.isRealtor ? null : opts.userId === undefined ? userId : opts.userId;
  const userChanged = nextUser !== userId;
  userId = nextUser;

  if (opts.isRealtor === enabled && !userChanged) {
    if (soundChanged) publish();
    return;
  }
  if (userChanged && enabled && opts.isRealtor) {
    // Другой риэлтор в той же вкладке: его счётчики — с чистого листа.
    counts = null;
  }
  enabled = opts.isRealtor;
  if (!enabled) {
    reset();
    return;
  }
  bindWindow();
  publish();
  if (listeners.size > 0) {
    startTimer();
    void fetchCounts();
  }
}

/** Локально применить новое значение переключателя звука (оптимистично). */
export function setCrmNotifySoundEnabled(value: boolean): void {
  if (soundEnabled === value) return;
  soundEnabled = value;
  publish();
}

/** Немедленный пересчёт — после любого действия, меняющего прочтение/очередь. */
export function refreshCrmUnreadCounts(): void {
  void fetchCounts();
}

/**
 * Оптимистично уменьшить счётчики СРАЗУ (бейдж гаснет без ожидания сети).
 * Значения — на сколько уменьшить; ниже нуля не опускаемся.
 *
 * Порядок вызова: `applyCrmReadOptimistic({...})` ДО запроса действия, затем
 * `applyCrmReadOptimistic({})` ПОСЛЕ его ответа — пустая правка и есть
 * «подтвердить»: она запрашивает истину у сервера. Непустая правка сама НЕ
 * опрашивает сервер: тот ещё не применил действие и вернул бы старое число.
 */
export function applyCrmReadOptimistic(delta: {
  inquiries?: number;
  sale_requests?: number;
  notifications?: number;
  allNotifications?: boolean;
}): void {
  generation += 1;
  const confirm =
    !delta.inquiries && !delta.sale_requests && !delta.notifications && !delta.allNotifications;
  if (counts && !confirm) {
    const inquiries = Math.max(0, counts.inquiries - (delta.inquiries ?? 0));
    const sale_requests = Math.max(0, counts.sale_requests - (delta.sale_requests ?? 0));
    const notifications = delta.allNotifications
      ? 0
      : Math.max(0, counts.notifications - (delta.notifications ?? 0));
    counts = {
      ...counts,
      inquiries,
      sale_requests,
      total: inquiries + sale_requests,
      notifications,
      latest_notification_id: notifications === 0 ? 0 : counts.latest_notification_id,
    };
    publish();
  }
  if (confirm) {
    // Only now are the server and the lists in step: tell the tables to
    // re-read their rows, and fetch the true counts.
    emitReadStateChanged();
    void fetchCounts();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && enabled) {
    bindWindow();
    startTimer();
    void fetchCounts();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTimer();
  };
}

function getSnapshot() {
  return snapshot;
}

/** Серверный снимок: счётчиков на сервере нет — токен живёт в localStorage. */
const SERVER_SNAPSHOT = { counts: null, soundEnabled: true, enabled: false } as const;
function getServerSnapshot() {
  return SERVER_SNAPSHOT as unknown as typeof snapshot;
}

export const crmUnreadStore = { subscribe, getSnapshot, getServerSnapshot };

/** Отображаемый текст бейджа. Потолок 99+. */
export const UNREAD_BADGE_CAP = 99;
export function formatUnreadBadge(n: number): string {
  return n > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(n);
}

/**
 * Подписка на счётчики. `counts: null`, пока первый ответ не пришёл (и всегда —
 * для не-риэлторов), чтобы «пока не знаем» не нарисовать как «непрочитанного нет».
 */
export function useCrmUnreadCounts() {
  return useSyncExternalStore(
    crmUnreadStore.subscribe,
    crmUnreadStore.getSnapshot,
    crmUnreadStore.getServerSnapshot,
  );
}

/**
 * Перечитать строки списка, когда меняется состояние прочтения (правило 6):
 * новое уведомление нашёл опрос, «прочитано» в колокольчике, массовое
 * действие в другой таблице. Колбэк вызывается не чаще раза в 400 мс.
 */
export function useCrmReadStateRefresh(reload: () => void): void {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onEvt = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        ref.current();
      }, 400);
    };
    window.addEventListener(CRM_READ_STATE_EVENT, onEvt);
    return () => {
      window.removeEventListener(CRM_READ_STATE_EVENT, onEvt);
      if (t) clearTimeout(t);
    };
  }, []);
}
