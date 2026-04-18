import type { NextConfig } from "next";

function trimEndSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * `/api/*` → Django at `BACKEND_URL` (resolved when Next loads this config — typically
 * `next build` / `next start` in the container). Must not be the public Next.js origin.
 *
 * Auth routes get slash-normalized rules so Django does not APPEND_SLASH-redirect when
 * the framework strips a trailing slash.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    const fromEnv = process.env.BACKEND_URL?.trim();
    const backend = fromEnv ? trimEndSlashes(fromEnv) : "http://localhost:8001";
    const apiBase = `${backend}/api`;
    return [
      { source: "/api/auth/login", destination: `${apiBase}/auth/login/` },
      { source: "/api/auth/logout", destination: `${apiBase}/auth/logout/` },
      { source: "/api/auth/refresh", destination: `${apiBase}/auth/refresh/` },
      { source: "/api/auth/me", destination: `${apiBase}/auth/me/` },
      { source: "/api/:path*", destination: `${apiBase}/:path*` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ];
  },
};

export default nextConfig;
