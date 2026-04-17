/** Keep in sync: localStorage keys, cookie mirror (client + middleware). */
export const CRM_ACCESS_LS_KEY = "centreal_access";
export const CRM_REFRESH_LS_KEY = "centreal_refresh";
/** Non-HttpOnly cookie set on login so Edge middleware can gate /account. */
export const CRM_ACCESS_COOKIE_NAME = "centreal_access";

const AUTH_PATHS = {
  login: "auth/login/",
  me: "auth/me/",
  refresh: "auth/refresh/",
  logout: "auth/logout/",
} as const;

export type EmployeeAuthEndpoint = keyof typeof AUTH_PATHS;

function trimEndSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Browser-visible Django API base including `/api` (same as JWT).
 * Must match production build env so CRM calls never fall back to same-origin `/api/...`
 * (Next rewrites + Django APPEND_SLASH can produce ERR_TOO_MANY_REDIRECTS).
 */
function browserDjangoApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  const base = trimEndSlashes(
    raw || (process.env.NODE_ENV !== "production" ? "http://localhost:8001/api" : ""),
  );
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL must be set for employee / CRM API requests.");
  }
  return base;
}

/**
 * Absolute backend URL for employee JWT endpoints from the browser.
 * Uses NEXT_PUBLIC_API_URL (see .env.example: must include `/api`) so fetches skip
 * Next.js rewrites and trailing-slash normalization that collides with Django APPEND_SLASH.
 */
export function employeeAuthAbsoluteUrl(endpoint: EmployeeAuthEndpoint): string {
  return `${browserDjangoApiBase()}/${AUTH_PATHS[endpoint]}`;
}

/**
 * Browser fetch URL for `/api/...` CRM and справочники.
 * Uses the same Django origin as JWT (`browserDjangoApiBase`),
 * avoiding mismatches with Next.js rewrites (BACKEND_URL) in Docker or split-host setups.
 */
export function crmBrowserApiUrl(apiPath: string): string {
  const p = apiPath.trim();
  if (!p.startsWith("/api/")) return p;
  const base = browserDjangoApiBase();
  const rest = p.slice("/api".length);
  return `${base}${rest}`;
}
