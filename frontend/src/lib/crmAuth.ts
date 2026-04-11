import {
  CRM_ACCESS_COOKIE_NAME,
  CRM_ACCESS_LS_KEY,
  CRM_REFRESH_LS_KEY,
} from "@/lib/crmAuthConstants";

const ACCESS_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

function syncAccessCookie(access: string | null): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  const base = `Path=/; SameSite=Lax${secure}`;
  if (!access) {
    document.cookie = `${CRM_ACCESS_COOKIE_NAME}=; ${base}; Max-Age=0`;
    return;
  }
  document.cookie = `${CRM_ACCESS_COOKIE_NAME}=${encodeURIComponent(access)}; ${base}; Max-Age=${ACCESS_COOKIE_MAX_AGE_SEC}`;
}

export function getCrmAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CRM_ACCESS_LS_KEY);
}

export function setCrmTokens(access: string, refresh: string): void {
  window.localStorage.setItem(CRM_ACCESS_LS_KEY, access);
  window.localStorage.setItem(CRM_REFRESH_LS_KEY, refresh);
  syncAccessCookie(access);
}

export function clearCrmTokens(): void {
  window.localStorage.removeItem(CRM_ACCESS_LS_KEY);
  window.localStorage.removeItem(CRM_REFRESH_LS_KEY);
  syncAccessCookie(null);
}

export function authBearerHeaders(): HeadersInit {
  const t = getCrmAccessToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}
