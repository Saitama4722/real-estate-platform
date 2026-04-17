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
 * Absolute backend URL for employee JWT endpoints from the browser.
 * Uses NEXT_PUBLIC_API_URL (see .env.example: must include `/api`) so fetches skip
 * Next.js rewrites and trailing-slash normalization that collides with Django APPEND_SLASH.
 */
export function employeeAuthAbsoluteUrl(endpoint: EmployeeAuthEndpoint): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  const base = trimEndSlashes(
    raw || (process.env.NODE_ENV !== "production" ? "http://localhost:8001/api" : ""),
  );
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL must be set for employee authentication.");
  }
  return `${base}/${AUTH_PATHS[endpoint]}`;
}
