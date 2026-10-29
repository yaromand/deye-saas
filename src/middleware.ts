import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight route guards by path prefix.
 * Full session verification happens in layouts / API (iron-session needs Node).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("deye_session");

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isClientApp =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/inverters") ||
    pathname.startsWith("/telegram");
  const isAdminApp = pathname.startsWith("/admin");

  if ((isClientApp || isAdminApp) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/inverters/:path*",
    "/telegram/:path*",
    "/admin/:path*",
  ],
};
