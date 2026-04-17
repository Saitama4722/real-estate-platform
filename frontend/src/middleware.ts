import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_ACCESS_COOKIE_NAME } from "@/lib/crmAuthConstants";

function trimEndSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Django origin for same-origin `/api/*` browser calls. Resolved at request time so
 * production never bakes a wrong rewrite target from `next build` (a common cause of
 * ERR_TOO_MANY_REDIRECTS when BACKEND_URL is only set at container runtime).
 */
function backendOriginForApiProxy(): string | null {
  const fromEnv = process.env.BACKEND_URL?.trim();
  if (fromEnv) return trimEndSlashes(fromEnv);
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8001";
  }
  return null;
}

/**
 * Fail fast when the proxy target would loop.
 * - Same origin as the browser request (classic misconfiguration).
 * - Same hostname with browser HTTPS and BACKEND_URL HTTP: Railway/public edges
 *   redirect HTTP→HTTPS on the same host/path → ERR_TOO_MANY_REDIRECTS (origin
 *   equality misses this because schemes differ).
 * Local dev keeps http://localhost:3000 → http://localhost:8001 (same host,
 * both HTTP, different ports) — allowed.
 */
function selfProxyErrorResponse(
  request: NextRequest,
  backendOrigin: string,
): NextResponse | null {
  if (process.env.SKIP_BACKEND_SITE_HOST_CHECK === "1") return null;
  let backendUrl: URL;
  try {
    backendUrl = new URL(
      backendOrigin.includes("://") ? backendOrigin : `http://${backendOrigin}`,
    );
  } catch {
    return null;
  }
  const incomingOrigin = request.nextUrl.origin;
  const backendOriginNormalized = backendUrl.origin;
  if (incomingOrigin === backendOriginNormalized) {
    return NextResponse.json(
      {
        detail:
          "Misconfiguration: BACKEND_URL must not use the same origin as this Next.js app; the /api proxy would redirect in a loop. Use the Django service private URL (e.g. *.railway.internal) or another host.",
      },
      { status: 500 },
    );
  }
  const incomingHost = request.nextUrl.hostname.toLowerCase();
  const backendHost = backendUrl.hostname.toLowerCase();
  if (
    incomingHost === backendHost &&
    request.nextUrl.protocol === "https:" &&
    backendUrl.protocol === "http:"
  ) {
    return NextResponse.json(
      {
        detail:
          "Misconfiguration: BACKEND_URL uses http:// on the same hostname as this HTTPS site; the edge redirects to HTTPS and the /api proxy loops. Use the Django private URL (e.g. *.railway.internal) or https:// on a dedicated API host.",
      },
      { status: 500 },
    );
  }
  return null;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

  if (isApiRoute) {
    const backend = backendOriginForApiProxy();
    if (!backend) {
      return NextResponse.json(
        {
          detail:
            "BACKEND_URL is not set; cannot proxy /api requests. Configure the Django origin for this environment.",
        },
        { status: 500 },
      );
    }
    const loop = selfProxyErrorResponse(request, backend);
    if (loop) return loop;

    const destination = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      trimEndSlashes(backend) + "/",
    );

    const outgoingHeaders = new Headers(request.headers);
    const xfProtoHeader = request.headers.get("x-forwarded-proto");
    const xfProtoFirst =
      xfProtoHeader?.split(",")[0]?.trim() ?? "";
    const proto =
      xfProtoFirst ||
      (request.nextUrl.protocol === "https:" ? "https" : "http");
    outgoingHeaders.set("x-forwarded-proto", proto);
    const xfHost =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (xfHost) outgoingHeaders.set("x-forwarded-host", xfHost);

    return NextResponse.rewrite(destination, {
      request: { headers: outgoingHeaders },
    });
  }

  if (pathname === "/account/login" || pathname.startsWith("/account/login/")) {
    return NextResponse.next();
  }
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    const token = request.cookies.get(CRM_ACCESS_COOKIE_NAME)?.value;
    if (!token?.trim()) {
      const url = request.nextUrl.clone();
      url.pathname = "/account/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api", "/api/:path*", "/account", "/account/:path*"],
};
