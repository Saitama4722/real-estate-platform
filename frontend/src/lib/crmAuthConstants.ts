/** Keep in sync: localStorage keys, cookie mirror (client + middleware). */
export const CRM_ACCESS_LS_KEY = "centreal_access";
export const CRM_REFRESH_LS_KEY = "centreal_refresh";
/** Non-HttpOnly cookie set on login so Edge middleware can gate /account. */
export const CRM_ACCESS_COOKIE_NAME = "centreal_access";

/** Django APPEND_SLASH: POST must target the slash-terminated route. */
export const API_AUTH_LOGIN_URL = "/api/auth/login/";
