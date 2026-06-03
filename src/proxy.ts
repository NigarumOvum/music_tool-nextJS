import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico"];

function isPublicPath(pathname: string) {
  if (AUTH_PAGES.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/api/auth")) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (hasSession && AUTH_PAGES.has(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession && pathname.startsWith("/api/music")) {
    return NextResponse.json({ error: "Unauthorized", details: null }, { status: 401 });
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/music/:path*"],
};