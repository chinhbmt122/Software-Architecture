import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { voteReviewHelpful } from "@/modules/community"

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const isHelpful = await voteReviewHelpful(id, session.user.id)
    return NextResponse.json({ helpful: isHelpful })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vote failed"
    const status = message === "Cannot vote on own review" ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
