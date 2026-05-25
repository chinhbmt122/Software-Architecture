import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { unlockChapter } from "@/modules/monetization"
import { writeAuditLog } from "@/modules/admin"

interface Params {
  params: Promise<{ id: string; chapterId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, chapterId } = await params
  if (!UUID_RE.test(chapterId)) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
  }

  try {
    const newBalance = await unlockChapter(session.user.id, chapterId)
    void writeAuditLog(session.user.id, "UNLOCK_CHAPTER", "CHAPTER", chapterId, { novelId: id })
    return NextResponse.json({ success: true, newBalance })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unlock failed"
    const status =
      message === "Insufficient coins" ? 402 :
        message === "Chapter not found" ? 404 :
          message === "Chapter is not VIP" ? 400 :
            500
    return NextResponse.json({ error: message }, { status })
  }
}
