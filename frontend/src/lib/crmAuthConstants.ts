/** Keep in sync: localStorage keys, cookie mirror (client + server layout gate). */
export const CRM_ACCESS_LS_KEY = "centreal_access";
export const CRM_REFRESH_LS_KEY = "centreal_refresh";
/**
 * Non-HttpOnly cookie set on login so the server-side `(cabinet)/layout.tsx`
 * gate can redirect cookie-less visitors to /account/login before any cabinet
 * page renders (this replaced the former Edge middleware — see that layout).
 */
export const CRM_ACCESS_COOKIE_NAME = "centreal_access";

const AUTH_PATHS = {
  login: "auth/login/",
  me: "auth/me/",
  refresh: "auth/refresh/",
  logout: "auth/logout/",
} as const;

export type EmployeeAuthEndpoint = keyof typeof AUTH_PATHS;

/**
 * Same-origin `/api/auth/...` so the browser always uses Next.js rewrites to `BACKEND_URL`.
 * Do not build an absolute URL from `NEXT_PUBLIC_API_URL` to the public site host: that
 * re-enters the Next.js proxy and, when rewrites are misderived, causes ERR_TOO_MANY_REDIRECTS.
 */
export function employeeAuthAbsoluteUrl(endpoint: EmployeeAuthEndpoint): string {
  return `/api/${AUTH_PATHS[endpoint]}`;
}

/**
 * Browser-visible URL for `/api/...` CRM and справочники requests.
 * Same-origin relative paths use Next.js rewrites (never the duplicated public API hostname).
 *
 * Trailing slashes are stripped before the query string (or end of string) so that
 * Next.js never emits a 308 trailing-slash redirect. The beforeFiles rewrite in
 * next.config.ts then appends the slash when forwarding to Django, preventing the
 * Next.js-308 ↔ Django-301 infinite redirect loop.
 */
export function crmBrowserApiUrl(apiPath: string): string {
  const p = apiPath.trim();
  if (!p.startsWith("/api/")) return p;
  // Strip trailing slash before "?" or end-of-string: "/api/foo/" → "/api/foo", "/api/foo/?x=1" → "/api/foo?x=1"
  return p.replace(/\/(\?|$)/, "$1");
}
