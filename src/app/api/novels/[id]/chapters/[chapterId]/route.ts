import { auth } from "@/lib/auth"
import {
  deleteChapter,
  getChapterAccessSummaryById,
  getChapterById,
  getNovelById,
  updateChapter,
  updateChapterSchema,
} from "@/modules/content"
import { checkChapterAccess } from "@/modules/monetization"
import { fanOutNewChapterNotification } from "@/modules/reader"
import { buildNovelDoc, indexNovel } from "@/modules/search"
import { writeAuditLog } from "@/modules/admin"
import { logger } from "@/lib/logger"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params
  if (!UUID_RE.test(chapterId)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const summary = await getChapterAccessSummaryById(chapterId)
  if (!summary || summary.novelId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const session = await auth.api.getSession({ headers: await headers() })
  const canRead = !summary.isVip || (session ? (await checkChapterAccess(session.user.id, summary.id)).canRead : false)
  const body = canRead ? await getChapterById(chapterId) : { ...summary, content: null }
  const res = NextResponse.json(body)
  if (!summary.isVip) {
    res.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=3600")
  }
  return res
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, chapterId } = await params
  const body = await req.json()
  const parsed = updateChapterSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { chapter, justPublished } = await updateChapter(chapterId, parsed.data)

  if (justPublished && chapter) {
    const novel = await getNovelById(id)
    if (novel) {
      fanOutNewChapterNotification(novel.id, novel.title, chapter.id, chapter.chapterNumber, chapter.title)
        .catch((err) => logger.error({ err, novelId: novel.id, chapterId: chapter.id }, "Notification fan-out failed (PATCH)"))
      void buildNovelDoc(novel.id).then((doc) => doc && indexNovel(doc))
    }
  }

  void writeAuditLog(session.user.id, "UPDATE_CHAPTER", "CHAPTER", chapterId, {
    novelId: id,
    chapterNumber: chapter?.chapterNumber,
    title: chapter?.title,
  })
  return NextResponse.json(chapter)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, chapterId } = await params
  const chap = await getChapterById(chapterId)
  await deleteChapter(chapterId)
  void writeAuditLog(session.user.id, "DELETE_CHAPTER", "CHAPTER", chapterId, {
    novelId: id,
    chapterNumber: chap?.chapterNumber,
    title: chap?.title,
  })
  return new NextResponse(null, { status: 204 })
}
