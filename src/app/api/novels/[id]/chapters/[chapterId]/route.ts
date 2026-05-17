import { auth } from "@/lib/auth"
import { deleteChapter, getChapterById, updateChapter, updateChapterSchema } from "@/modules/content"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { chapterId } = await params
  const chapter = await getChapterById(chapterId)
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(chapter)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { chapterId } = await params
  const body = await req.json()
  const parsed = updateChapterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const chapter = await updateChapter(chapterId, parsed.data)
  return NextResponse.json(chapter)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { chapterId } = await params
  await deleteChapter(chapterId)
  return new NextResponse(null, { status: 204 })
}
