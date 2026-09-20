import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, sessionCookieName } from "@/lib/auth";

// Next 16 renamed Middleware → Proxy (same functionality). Protects every route
// except /login, static assets, and the manifest.  SPEC §10.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.svg" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/");

  const token = request.cookies.get(sessionCookieName)?.value;
  const authed = await verifySession(token);

  if (!isPublic && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already logged in? Keep them out of /login.
  if (pathname === "/login" && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
