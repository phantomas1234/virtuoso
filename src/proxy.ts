import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default auth((req: NextRequest & { auth: { user?: { id?: string } } | null }) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

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
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
