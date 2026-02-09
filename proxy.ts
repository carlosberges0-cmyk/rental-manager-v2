import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Redirect NextAuth error page to our custom /auth/error (with instructions)
  if (pathname === "/api/auth/error") {
    const error = req.nextUrl.searchParams.get("error") || "Configuration"
    const redirectUrl = new URL(`/auth/error?error=${encodeURIComponent(error)}`, req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Allow public paths
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Check for NextAuth session token cookie
  // NextAuth stores the session token in these cookies (names vary by environment)
  const sessionToken = 
    req.cookies.get("__Secure-next-auth.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value

  if (!sessionToken) {
    const signInUrl = new URL("/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Redirect /api/auth/error to our custom error page
    "/api/auth/error",
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - auth (auth pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico|.*\\..*|$).*)",
  ],
}
