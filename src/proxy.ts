import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PAGES = ["/library", "/settings", "/profile"]
const ADMIN_PAGES = ["/admin"]
const CURATOR_PAGES = ["/curator"]
const ADMIN_API_PREFIX = "/api/admin"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const isAdminPage = ADMIN_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isCuratorPage = CURATOR_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAdminRoute = pathname.startsWith(ADMIN_API_PREFIX)

  if (!isProtectedPage && !isAdminPage && !isCuratorPage && !isAdminRoute) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    if (isAdminRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (isAdminRoute && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (isAdminPage && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (isCuratorPage && session.user.role !== "CURATOR" && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/library/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/curator/:path*",
    "/api/admin/:path*",
  ],
}
