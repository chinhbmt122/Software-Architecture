import { auth } from "@/lib/auth"
import { createChapter, createChapterSchema, listChaptersByNovel, getNovelById } from "@/modules/content"
import { fanOutNewChapterNotification } from "@/modules/reader"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const isCurator = session?.user.role === "CURATOR" || session?.user.role === "ADMIN"
  const list = await listChaptersByNovel(id, isCurator)
  return NextResponse.json(list)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = createChapterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const chapter = await createChapter(id, parsed.data)

  // Fan out notifications to followers when a chapter is published
  if (chapter.status === "PUBLISHED") {
    const novel = await getNovelById(id)
    if (novel) {
      fanOutNewChapterNotification(novel.id, novel.title, chapter.id, chapter.chapterNumber, chapter.title)
        .catch(console.error) // fire-and-forget, don't block response
    }
  }

  return NextResponse.json(chapter, { status: 201 })
}
