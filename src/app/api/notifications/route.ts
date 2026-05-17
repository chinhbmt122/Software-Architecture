import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { listNotifications } from "@/modules/reader"

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  const result = await listNotifications(session.user.id, cursor)
  return NextResponse.json(result)
}
