/**
 * Короткий сигнал о новых заявках в CRM.
 *
 * ⭐ ФАЙЛ УЖЕ ЛЕЖИТ В РЕПОЗИТОРИИ: `public/sounds/crm-inquiry-notify.wav`,
 * 7 982 байта (~8 КБ). Он добавлен вместе с опросом заявок и здесь просто
 * переиспользован — нового звука не заводили и генератор тона не писали.
 *
 * ⭐ ПОЛИТИКА АВТОВОСПРОИЗВЕДЕНИЯ ОБРАБОТАНА, А НЕ ЗАМОЛЧАНА.
 *
 * Браузер отклоняет `play()` с `NotAllowedError`, пока на странице не было
 * жеста пользователя. Прошлая версия ловила это и забывала: если первая попытка
 * пришлась на «холодную» вкладку, звук был потерян и восстановить его было
 * нечем. Здесь наоборот:
 *
 *   • отказ НИКОГДА не выключает функцию навсегда — следующий вызов пробует
 *     снова (постоянного флага «сломано» нет намеренно);
 *   • на первый же жест пользователя (`pointerdown` / `keydown` / `touchstart`)
 *     элемент разблокируется БЕЗЗВУЧНО (`muted` + `play()` + `pause()`), поэтому
 *     к моменту реального уведомления разрешение обычно уже получено;
 *   • промах не пишется в консоль: обещание всегда с `.catch`, и синхронный
 *     бросок тоже прикрыт, так что чистая консоль остаётся чистой.
 */

const SOUND_URL = "/sounds/crm-inquiry-notify.wav";
const VOLUME = 0.32;

let audio: HTMLAudioElement | null = null;
let unlockBound = false;
/** Разблокирован ли звук жестом. Это ПОДСКАЗКА, а не запрет: `play()` зовётся
    в любом случае — браузер может разрешить и без неё. */
let unlocked = false;

function element(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audio) return audio;
  try {
    audio = new Audio(SOUND_URL);
    audio.preload = "auto";
    audio.volume = VOLUME;
  } catch {
    audio = null;
  }
  return audio;
}

/** Тихо «прогреть» элемент на жесте пользователя, чтобы к реальному сигналу
    разрешение уже было выдано. Ничего не слышно: играем в mute и сразу стоп. */
function unlockOnGesture(): void {
  if (unlocked) return;
  const el = element();
  if (!el) return;
  const wasMuted = el.muted;
  el.muted = true;
  try {
    const p = el.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = wasMuted;
          unlocked = true;
        })
        .catch(() => {
          el.muted = wasMuted;
        });
      return;
    }
    el.pause();
    el.currentTime = 0;
    el.muted = wasMuted;
    unlocked = true;
  } catch {
    el.muted = wasMuted;
  }
}

function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const opts: AddEventListenerOptions = { passive: true };
  for (const evt of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(evt, unlockOnGesture, opts);
  }
}

if (typeof window !== "undefined") bindUnlock();

/**
 * Проиграть сигнал. Никогда не бросает и никогда не пишет в консоль.
 *
 * ⚠ Вызывать ТОЛЬКО на РОСТ счётчика непрочитанного. Ни на каждый опрос, ни при
 * загрузке страницы — за это отвечает `lib/crmUnreadCounts.ts`, там базовый
 * уровень задаётся первым успешным ответом и молча.
 */
export function playCrmNotifySound(): void {
  const el = element();
  if (!el) return;
  bindUnlock();
  try {
    el.pause();
    el.currentTime = 0;
    el.muted = false;
    el.volume = VOLUME;
    const p = el.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => {
          unlocked = true;
        })
        .catch(() => {
          /* Политика автовоспроизведения или отсутствующий файл. Молчим и
             НИЧЕГО не выключаем: следующий вызов попробует снова. */
        });
    }
  } catch {
    /* Молчим — см. выше. */
  }
}

/** Прежнее имя, оставлено для существующего вызова в AccountInquiriesTable. */
export const playCrmNewInquirySound = playCrmNotifySound;
