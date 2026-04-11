import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_ACCESS_COOKIE_NAME } from "@/lib/crmAuthConstants";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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
  matcher: ["/account", "/account/:path*"],
};
