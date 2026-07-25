import type { NextConfig } from "next";

function trimEndSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Origin (scheme + host + port) for detecting self-referential rewrites. */
function originKey(urlish: string): string | null {
  const t = urlish.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    const host = u.hostname.toLowerCase();
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    return `${u.protocol}//${host}:${port}`;
  } catch {
    return null;
  }
}

/**
 * `NEXT_PUBLIC_API_URL` is usually `https://django-host.../api` — strip that suffix so
 * rewrites target Django, not the browser's Next.js origin when BACKEND_URL is mis-set.
 */
function djangoBaseFromPublicApiUrl(apiUrl: string): string | null {
  const t = apiUrl.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    let path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/api" || path.endsWith("/api")) {
      path = path === "/api" ? "/" : path.slice(0, -4) || "/";
    }
    const suffix = path === "/" ? "" : path;
    return trimEndSlashes(`${u.origin}${suffix}`);
  } catch {
    return null;
  }
}

/**
 * Django origin for `/api/*` and `/media/*` rewrites.
 *
 * If `BACKEND_URL` equals the public Next.js origin (from `NEXT_PUBLIC_SITE_URL`
 * and/or same host as `NEXT_PUBLIC_API_URL`), Next would proxy `/api` to itself →
 * ERR_TOO_MANY_REDIRECTS. Recovery order:
 *   1. Use `NEXT_PUBLIC_API_URL` host if it differs from `BACKEND_URL`.
 *   2. Use `BACKEND_INTERNAL_URL` (Railway private service URL).
 *   3. Throw — deployment is misconfigured.
 */
function resolveDjangoBaseForApiRewrites(): string {
  const siteRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const configuredRaw = process.env.BACKEND_URL?.trim() ?? "";
  const apiPublicRaw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  const internalRaw = process.env.BACKEND_INTERNAL_URL?.trim() ?? "";
  const railwayPublicRaw =
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
    process.env.RAILWAY_STATIC_URL?.trim() ||
    "";

  const defaultLocal = "http://localhost:8001";
  let backend = configuredRaw ? trimEndSlashes(configuredRaw) : defaultLocal;

  const siteOrigin = siteRaw ? originKey(siteRaw) : null;
  const configuredOrigin = originKey(backend);
  const fromApi = apiPublicRaw ? djangoBaseFromPublicApiUrl(apiPublicRaw) : null;
  const fromApiOrigin = fromApi ? originKey(fromApi) : null;
  const railwayPublicOrigin = railwayPublicRaw
    ? originKey(railwayPublicRaw.includes("://") ? railwayPublicRaw : `https://${railwayPublicRaw}`)
    : null;

  const backendCollidesWithPublicProxy =
    Boolean(configuredOrigin) &&
    (Boolean(siteOrigin && siteOrigin === configuredOrigin) ||
      Boolean(fromApiOrigin && fromApiOrigin === configuredOrigin) ||
      Boolean(railwayPublicOrigin && railwayPublicOrigin === configuredOrigin));

  if (backendCollidesWithPublicProxy) {
    if (fromApi && fromApiOrigin && fromApiOrigin !== configuredOrigin) {
      backend = fromApi;
    } else if (internalRaw) {
      backend = trimEndSlashes(internalRaw);
    } else {
      throw new Error(
        "Invalid proxy config: BACKEND_URL matches the public site/API origin, so Next.js /api rewrites would call itself (ERR_TOO_MANY_REDIRECTS). " +
          "Set BACKEND_URL to your Django origin (e.g. Railway private URL), or set NEXT_PUBLIC_API_URL to an absolute URL on a different host than the site, " +
          "or set BACKEND_INTERNAL_URL for same-host deployments. If NEXT_PUBLIC_SITE_URL is unset at build time, same-origin NEXT_PUBLIC_API_URL still triggers this check.",
      );
    }
  }

  return backend;
}

/**
 * `/api/*` → Django at `resolveDjangoBaseForApiRewrites()` (build/start time).
 * `/media/*` → Django media root (dev: FileSystem, prod: proxied through Next.js).
 *
 * Two wildcard rules cover every path in both slash and slash-less form, always
 * forwarding to Django with a trailing slash. This prevents the redirect loop:
 *   Next.js 308 strips slash → generic rule hits Django without slash →
 *   Django APPEND_SLASH 301 adds slash → Next.js 308 again → ERR_TOO_MANY_REDIRECTS.
 * Placing these in `beforeFiles` ensures they run before Next.js page routing so
 * the trailing-slash normalisation redirect never fires for /api/* paths.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    const backend = resolveDjangoBaseForApiRewrites();
    const apiBase = `${backend}/api`;
    return {
      beforeFiles: [
        // Slash form: forward as-is (already has slash Django expects).
        { source: "/api/:path*/", destination: `${apiBase}/:path*/` },
        // Slash-less form: append slash so Django APPEND_SLASH never needs to redirect.
        { source: "/api/:path*", destination: `${apiBase}/:path*/` },
        { source: "/media/:path*", destination: `${backend}/media/:path*` },
      ],
    };
  },
};

export default nextConfig;
