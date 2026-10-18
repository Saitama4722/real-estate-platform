"use client";

/**
 * Счётчики непрочитанных заявок для шапки и бокового меню кабинета.
 *
 * ⭐ ОДИН ОПРОС НА ВСЁ ПРИЛОЖЕНИЕ. Это модульный синглтон поверх
 * `useSyncExternalStore`, а НЕ React-контекст, по одной причине: бейдж в шапке
 * (`HeaderAccountControls`, корневой layout) и счётчики в боковом меню
 * (`AccountSidebar`, внутри `/account/(cabinet)`) живут в РАЗНЫХ поддеревьях.
 * Провайдер, накрывающий оба, пришлось бы вешать на корневой layout и он
 * перерисовывал бы всё дерево каждые 30 секунд. Синглтон обновляет ровно тех,
 * кто подписан.
 *
 * ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ ЗАКРЕПЛЕНЫ:
 *
 * 1. **Опрос, а не WebSocket** — у проекта нет ASGI-сервера, и заводить его
 *    ради счётчика не станем (решение владельца). 30 секунд задержки для лида
 *    приемлемы. Не превращайте это в Channels.
 * 2. **Скрытая вкладка не опрашивается.** Таймер снимается на `visibilitychange`
 *    и возвращается вместе с НЕМЕДЛЕННЫМ запросом, когда вкладка снова видна, —
 *    иначе после возвращения пришлось бы ждать до 30 секунд.
 * 3. **Неудачный опрос МОЛЧИТ.** Ни исключения наружу, ни состояния ошибки, ни
 *    записи в консоль: сеть моргнула — просто ждём следующего интервала.
 *    Счётчик не имеет права ломать шапку.
 * 4. **Звук — по УВЕДОМЛЕНИЯМ колокольчика, по «последнему прозвоненному id»
 *    (2026-10-18, заменило правило «никогда при загрузке»).** Ручка отдаёт
 *    `latest_notification_id` — id самого свежего НЕПРОЧИТАННОГО уведомления
 *    за 24 часа. В localStorage (ключ на пользователя) лежит id, для которого
 *    уже звучали. Звук ⇔ `latest > lastChimed`; сразу после этого `lastChimed
 *    = latest`. Отсюда ровно три свойства:
 *      • пришло, пока риэлтора не было, — ОДИН сигнал при входе;
 *      • пришло, пока он на сайте, — один сигнал на новое уведомление;
 *      • перезагрузка / переход по страницам — тишина: id тот же.
 *    Вкладки делят localStorage, поэтому две открытые вкладки не звонят
 *    дважды (кто опросил первым, тот и записал id).
 */

import { useSyncExternalStore } from "react";

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

/** 30 секунд — согласованный интервал. Меняя его, поменяйте и CLAUDE.md. */
const POLL_INTERVAL_MS = 30_000;

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
let visibilityBound = false;

const listeners = new Set<() => void>();

/** Ссылочно стабильный снимок: `useSyncExternalStore` сравнивает по `Object.is`,
    и новый объект на каждый вызов `getSnapshot` дал бы бесконечный ререндер. */
let snapshot: { counts: CrmUnreadCounts | null; soundEnabled: boolean; enabled: boolean } = {
  counts: null,
  soundEnabled: true,
  enabled: false,
};

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
  if (!enabled || inFlight) return;
  if (!getCrmAccessToken()) return;
  inFlight = true;
  try {
    const res = await fetchWithCrmAuthRetry("/api/crm/notifications/unread-counts/");
    if (!res.ok) return; // тихо: 401/403/500 — просто ждём следующего интервала
    const next = parseCounts(await res.json());
    if (!next) return;

    /* Звук — см. пункт 4 в шапке файла. Записываем id ВСЕГДА, даже при
       выключенном звуке: иначе включение звука прозвенело бы за давно
       пришедшее уведомление. */
    let chime = false;
    if (userId !== null && next.latest_notification_id > 0) {
      if (next.latest_notification_id > readLastChimed(userId)) {
        writeLastChimed(userId, next.latest_notification_id);
        chime = true;
      }
    }

    const changed = !sameCounts(counts, next);
    counts = next;
    if (changed) publish();
    if (chime && soundEnabled) playCrmNotifySound();
  } catch {
    /* Молча. Пункт 3 в шапке файла. */
  } finally {
    inFlight = false;
  }
}

function startTimer(): void {
  if (timerId !== null || !enabled) return;
  if (typeof document !== "undefined" && document.hidden) return;
  timerId = setInterval(() => {
    void fetchCounts();
  }, POLL_INTERVAL_MS);
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
  void fetchCounts(); // вкладку вернули — не заставляем ждать до 30 секунд
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", onVisibilityChange);
  visibilityBound = true;
}

function reset(): void {
  stopTimer();
  counts = null;
  publish();
}

/**
 * Сообщить хранилищу, кто сейчас вошёл. Зовут и шапка, и боковое меню — обе
 * уже держат ответ `/api/auth/me/`, так что второго запроса это не стоит.
 * Идемпотентно: одинаковые значения ничего не делают.
 *
 * `isRealtor=false` (суперадмин, администратор, аноним) полностью гасит опрос —
 * ручка и так вернула бы им нули, но лишний запрос каждые 30 секунд не нужен.
 */
export function configureCrmUnread(opts: {
  isRealtor: boolean;
  soundEnabled?: boolean;
  userId?: number | null;
}): void {
  const nextSound = opts.soundEnabled ?? soundEnabled;
  const soundChanged = nextSound !== soundEnabled;
  soundEnabled = nextSound;
  const nextUser = opts.isRealtor ? (opts.userId ?? null) : null;
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
  bindVisibility();
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

/** Немедленный пересчёт — после того как заявку отметили прочитанной. */
export function refreshCrmUnreadCounts(): void {
  void fetchCounts();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && enabled) {
    bindVisibility();
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

/** Серверный снимок: счётчиков на сервере нет и быть не может — токен живёт в
    localStorage. Возвращаем то же «пока неизвестно», иначе будет гидратационное
    расхождение. */
const SERVER_SNAPSHOT = { counts: null, soundEnabled: true, enabled: false } as const;
function getServerSnapshot() {
  return SERVER_SNAPSHOT as unknown as typeof snapshot;
}

export const crmUnreadStore = { subscribe, getSnapshot, getServerSnapshot };

/** Отображаемый текст бейджа. Потолок 99+: три знака — предел, за которым
    бейдж начинает раздвигать чип в шапке. */
export const UNREAD_BADGE_CAP = 99;
export function formatUnreadBadge(n: number): string {
  return n > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(n);
}

/**
 * Подписка на счётчики. Возвращает `counts: null`, пока первый ответ не пришёл
 * (и всегда — для не-риэлторов), чтобы «пока не знаем» нельзя было случайно
 * отрисовать как «непрочитанного нет».
 */
export function useCrmUnreadCounts() {
  return useSyncExternalStore(
    crmUnreadStore.subscribe,
    crmUnreadStore.getSnapshot,
    crmUnreadStore.getServerSnapshot,
  );
}
