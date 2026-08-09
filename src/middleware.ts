import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PAGE_PATHS = ["/login", "/setup"];
const PUBLIC_API_PREFIXES = ["/api/webhooks/", "/api/cron/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_PATHS.some((p) => pathname === p)) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim());

  if (!hasSessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
