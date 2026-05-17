import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const protectedPaths = ["/library", "/settings", "/profile", "/admin", "/curator"]

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })

  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  )

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
