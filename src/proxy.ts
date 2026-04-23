import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Auth.js database sessions use an opaque cookie token — no crypto needed here.
// Real session validation (DB lookup) happens in server components and API routes.
// This keeps the edge bundle tiny (well under Vercel's 1 MB hobby limit).
function hasSession(req: NextRequest) {
  return (
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token")
  )
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isLoggedIn = hasSession(req)

  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/settings")

  if (isAppRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
