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
 */
export function crmBrowserApiUrl(apiPath: string): string {
  const p = apiPath.trim();
  if (!p.startsWith("/api/")) return p;
  return p;
}
