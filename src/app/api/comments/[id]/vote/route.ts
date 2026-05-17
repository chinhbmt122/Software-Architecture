import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { voteComment } from "@/modules/community"
import { z } from "zod"

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({ voteType: z.enum(["UP", "DOWN"]) })

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  await voteComment(id, session.user.id, parsed.data.voteType)
  return NextResponse.json({ success: true })
}
