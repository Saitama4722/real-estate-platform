import type { NextConfig } from "next";

/**
 * Same-origin `/api/*` is proxied to Django in `src/middleware.ts` using `BACKEND_URL`
 * at request time (not baked into `next build`). That avoids production redirect loops when
 * rewrites were compiled against the wrong backend origin.
 *
 * Use BACKEND_URL — the Django base URL reachable from the Next.js process (e.g. Railway
 * private URL). It must not be the same host as the public Next.js URL.
 */

const nextConfig: NextConfig = {};

export default nextConfig;
