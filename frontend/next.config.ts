import type { NextConfig } from "next";

/**
 * Next.js rewrites proxy `/api/*` to BACKEND_URL. If BACKEND_URL points at the same
 * public host as the frontend (e.g. both set to the Next.js Railway URL), the proxy
 * targets itself and browsers see ERR_TOO_MANY_REDIRECTS on API calls.
 */
function normalizeEnvHost(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = t.includes("://") ? t : `https://${t}`;
    return new URL(withScheme).host.toLowerCase();
  } catch {
    return null;
  }
}

function rewriteTargetOriginHost(): string | null {
  const backend = (process.env.BACKEND_URL ?? "").trim();
  if (backend) return normalizeEnvHost(backend);
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (!apiUrl) return null;
  const trimEnd = (s: string) => s.replace(/\/+$/, "");
  const base = trimEnd(apiUrl);
  const originGuess = base.endsWith("/api") ? base.slice(0, -4) : base;
  return normalizeEnvHost(originGuess);
}

function assertProductionRewriteDoesNotSelfProxy(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_BACKEND_SITE_HOST_CHECK === "1") return;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rewriteBackendHost = rewriteTargetOriginHost();
  if (!site || !rewriteBackendHost) return;
  const siteHost = normalizeEnvHost(site);
  if (!siteHost || siteHost !== rewriteBackendHost) return;
  throw new Error(
    [
      "Production misconfiguration: Next.js API rewrites target the same host as NEXT_PUBLIC_SITE_URL.",
      "That proxies /api/* to the Next server itself (ERR_TOO_MANY_REDIRECTS).",
      "Fix: set BACKEND_URL to your Django origin reachable from the Next container (Railway private URL, e.g.",
      "http://<backend-service>.railway.internal:<port>, or the backend service public hostname), not the frontend URL.",
      "If the browser must call the same hostname for /api/, keep NEXT_PUBLIC_SITE_URL as the frontend only and set",
      "BACKEND_URL to the Django service; do not derive the rewrite target only from NEXT_PUBLIC_API_URL on the same host.",
      "To bypass this check (not recommended): SKIP_BACKEND_SITE_HOST_CHECK=1.",
    ].join(" "),
  );
}

assertProductionRewriteDoesNotSelfProxy();

/**
 * Without BACKEND_URL, rewrites fall back to the origin of NEXT_PUBLIC_API_URL. If that is
 * the frontend's public URL (same host as the browser), the proxy calls itself (ERR_TOO_MANY_REDIRECTS).
 * Require an explicit Django origin in production so deploys fail fast instead of breaking at runtime.
 */
function assertProductionBackendUrlForRewrites(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_BACKEND_SITE_HOST_CHECK === "1") return;
  if ((process.env.BACKEND_URL ?? "").trim()) return;
  throw new Error(
    [
      "Production requires BACKEND_URL: the Django origin that Next.js proxies /api/* to",
      "(e.g. http://backend.railway.internal:8000 or http://backend:8000 in Docker).",
      "Without it, NEXT_PUBLIC_API_URL-based rewrite targets may equal the frontend host and cause ERR_TOO_MANY_REDIRECTS.",
      "To bypass (not recommended): SKIP_BACKEND_SITE_HOST_CHECK=1.",
    ].join(" "),
  );
}

assertProductionBackendUrlForRewrites();

function backendOriginForRewrites(): string {
  const trimEnd = (s: string) => s.replace(/\/+$/, "");
  const backend = (process.env.BACKEND_URL ?? "").trim();
  if (backend) return trimEnd(backend);
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (apiUrl) {
    const base = trimEnd(apiUrl);
    return base.endsWith("/api") ? base.slice(0, -4) : base;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8001";
  }
  throw new Error(
    "Set NEXT_PUBLIC_API_URL or BACKEND_URL for Next.js API rewrites (required in production).",
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = backendOriginForRewrites();
    return [
      // Django defines `login/`; POST without trailing slash breaks APPEND_SLASH. Normalize at the proxy.
      {
        source: "/api/auth/login",
        destination: `${backend}/api/auth/login/`,
      },
      // Same as login: Next may 308-strip trailing slashes before rewrites; the catch-all would forward
      // `/api/auth/me` without `/` and Django APPEND_SLASH would 301 back → ERR_TOO_MANY_REDIRECTS.
      {
        source: "/api/auth/me",
        destination: `${backend}/api/auth/me/`,
      },
      {
        source: "/api/auth/refresh",
        destination: `${backend}/api/auth/refresh/`,
      },
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
