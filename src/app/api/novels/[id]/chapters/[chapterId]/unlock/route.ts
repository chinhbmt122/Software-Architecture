import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { unlockChapter } from "@/modules/monetization"

interface Params {
  params: Promise<{ id: string; chapterId: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { chapterId } = await params

  try {
    const newBalance = await unlockChapter(session.user.id, chapterId)
    return NextResponse.json({ success: true, newBalance })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unlock failed"
    const status = message === "Insufficient coins" ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
