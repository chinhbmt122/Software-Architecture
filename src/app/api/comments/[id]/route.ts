import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { deleteComment } from "@/modules/community"

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const deleted = await deleteComment(id, session.user.id)
  if (!deleted) return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 })
  return NextResponse.json({ success: true })
}
