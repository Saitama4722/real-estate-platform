/**
 * Mapping the REAL login API response onto the designed banners.
 *
 * ⚠ WRONG PASSWORD AND A DISABLED ACCOUNT ARE THE SAME 401, ON PURPOSE.
 * simplejwt answers both with `{"detail": "Не найдено активной учетной записи
 * с указанными данными"}` so the form cannot be used to discover which emails
 * belong to real employees. The mockup draws a separate «Учётная запись
 * заблокирована» banner; splitting the two would require a backend change that
 * turns login into an enumeration oracle, and the user decided against it
 * (2026-08-08). One 401 message it is.
 *
 * ⚠ Do NOT match on the English simplejwt string. The backend runs
 * LANGUAGE_CODE="ru-ru" with simplejwt's ru_RU catalogue installed, so the
 * English text never arrives — the previous implementation matched it, always
 * missed, and leaked the raw library string to the user.
 */

export type AuthBannerTone = "danger" | "warning";

export interface AuthBanner {
  tone: AuthBannerTone;
  title: string;
  body: string;
  /** Seconds until a retry is allowed; drives the throttle countdown. */
  retryAfterSec?: number;
}

export const AUTH_BANNERS = {
  credentials: {
    tone: "danger",
    title: "Неверный email или пароль",
    body: "Проверьте раскладку клавиатуры и регистр.",
  },
  badPayload: {
    tone: "danger",
    title: "Некорректный ответ сервера",
    body: "Попробуйте ещё раз. Если это повторится — сообщите администратору.",
  },
  server: {
    tone: "danger",
    title: "Сервис временно недоступен",
    body: "Не удалось выполнить вход. Попробуйте через несколько минут.",
  },
  network: {
    tone: "danger",
    title: "Нет связи с сервером",
    body: "Проверьте подключение к интернету и попробуйте снова.",
  },
} as const satisfies Record<string, AuthBanner>;

/** «Слишком много попыток» — the only banner whose copy depends on the response. */
export function throttleBanner(retryAfterSec?: number): AuthBanner {
  return {
    tone: "warning",
    title: "Слишком много попыток",
    body: retryAfterSec
      ? "Повторный вход будет доступен через"
      : "Повторите попытку через несколько минут.",
    retryAfterSec,
  };
}

/** `Retry-After` is seconds in DRF's throttling; tolerate an HTTP-date too. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header.trim());
  if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    const delta = Math.ceil((when - Date.now()) / 1000);
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}

export function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/**
 * Status → banner. Anything unmapped falls back to the credentials banner
 * rather than echoing a server string: the API's own text is a library
 * default, not copy anyone wrote for this product.
 */
export function bannerForStatus(
  status: number,
  retryAfterSec?: number,
): AuthBanner {
  if (status === 429) return throttleBanner(retryAfterSec);
  if (status >= 500) return AUTH_BANNERS.server;
  return AUTH_BANNERS.credentials;
}

/* ---- Field validation ------------------------------------------------------ */

/**
 * Deliberately permissive: one @, something either side, a dot in the domain.
 * A strict RFC pattern rejects addresses that really work, and the server is
 * the actual authority — this only catches obvious typos before a round trip.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Введите email";
  if (!EMAIL_RE.test(value)) return "Похоже на опечатку — проверьте адрес";
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Введите пароль";
  return null;
}
