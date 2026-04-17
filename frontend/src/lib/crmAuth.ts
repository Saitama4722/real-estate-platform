import {
  CRM_ACCESS_COOKIE_NAME,
  CRM_ACCESS_LS_KEY,
  CRM_REFRESH_LS_KEY,
  crmBrowserApiUrl,
  employeeAuthAbsoluteUrl,
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

/** Сообщить бэкенду о выходе (журнал), затем очистить токены. Сеть не блокирует выход из кабинета. */
export async function performEmployeeLogout(): Promise<void> {
  try {
    const headers = authBearerHeaders();
    if ("Authorization" in headers && headers.Authorization) {
      await fetch(employeeAuthAbsoluteUrl("logout"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  } catch {
    // игнорируем — локальный выход всё равно выполняется
  } finally {
    clearCrmTokens();
  }
}

export function authBearerHeaders(): HeadersInit {
  const t = getCrmAccessToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

function withAuthHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  const t = getCrmAccessToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  else headers.delete("Authorization");
  return { ...init, headers };
}

/** Обновить access (и refresh при ротации) по refresh-токену из localStorage. */
export async function refreshCrmAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refresh = window.localStorage.getItem(CRM_REFRESH_LS_KEY)?.trim();
  if (!refresh) return false;
  try {
    const res = await fetch(employeeAuthAbsoluteUrl("refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access?: unknown; refresh?: unknown };
    if (typeof data.access !== "string") return false;
    const nextRefresh = typeof data.refresh === "string" ? data.refresh : refresh;
    setCrmTokens(data.access, nextRefresh);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET/POST/PATCH… на `/api/...` с Bearer; при 401 один раз обновляет access и повторяет запрос.
 */
export async function fetchWithCrmAuthRetry(path: string, init?: RequestInit): Promise<Response> {
  const url = crmBrowserApiUrl(path);
  const res = await fetch(url, withAuthHeaders(init));
  if (res.status !== 401) return res;
  if (!(await refreshCrmAccessToken())) return res;
  return fetch(url, withAuthHeaders(init));
}
