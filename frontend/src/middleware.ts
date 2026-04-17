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
 * Fail fast if BACKEND_URL points at the same host the browser uses for the Next app.
 * Otherwise the proxy calls itself indefinitely (browser: ERR_TOO_MANY_REDIRECTS).
 */
function selfProxyErrorResponse(
  request: NextRequest,
  backendOrigin: string,
): NextResponse | null {
  if (process.env.SKIP_BACKEND_SITE_HOST_CHECK === "1") return null;
  let backendHost: string;
  try {
    const u = new URL(
      backendOrigin.includes("://") ? backendOrigin : `http://${backendOrigin}`,
    );
    backendHost = u.host.toLowerCase();
  } catch {
    return null;
  }
  if (request.nextUrl.host.toLowerCase() === backendHost) {
    return NextResponse.json(
      {
        detail:
          "Misconfiguration: BACKEND_URL must not use the same host as this Next.js app; the /api proxy would redirect in a loop. Use the Django service private URL (e.g. *.railway.internal) or another host.",
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
    const xfProto = request.headers.get("x-forwarded-proto");
    const xfHost =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (xfProto) outgoingHeaders.set("x-forwarded-proto", xfProto);
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
