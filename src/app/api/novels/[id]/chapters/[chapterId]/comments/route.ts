import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { listChapterComments, createComment } from "@/modules/community"
import { z } from "zod"

interface Params { params: Promise<{ id: string; chapterId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { chapterId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  const result = await listChapterComments(chapterId, session?.user.id ?? null, cursor)
  return NextResponse.json(result)
}

const bodySchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { chapterId } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const comment = await createComment(chapterId, session.user.id, parsed.data.content, parsed.data.parentId)
  return NextResponse.json(comment, { status: 201 })
}
