import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { chapters, readingProgress } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { novelId, chapterId, scrollPosition } = await req.json()
  if (!novelId || !chapterId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const [incomingChapter] = await db
    .select({ chapterNumber: chapters.chapterNumber })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.novelId, novelId)))
    .limit(1)
  if (!incomingChapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 })

  const [currentProgress] = await db
    .select({ chapterId: readingProgress.chapterId, chapterNumber: chapters.chapterNumber })
    .from(readingProgress)
    .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
    .where(and(eq(readingProgress.userId, session.user.id), eq(readingProgress.novelId, novelId)))
    .orderBy(desc(chapters.chapterNumber))
    .limit(1)

  if (currentProgress && currentProgress.chapterNumber > incomingChapter.chapterNumber) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  await db
    .insert(readingProgress)
    .values({
      userId: session.user.id,
      novelId,
      chapterId,
      scrollPosition: scrollPosition ?? 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.chapterId],
      set: { scrollPosition: scrollPosition ?? 0, updatedAt: new Date() },
    })

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json(null)

  const novelId = req.nextUrl.searchParams.get("novelId")
  if (!novelId) return NextResponse.json(null)

  const [progress] = await db
    .select({
      id: readingProgress.id,
      userId: readingProgress.userId,
      novelId: readingProgress.novelId,
      chapterId: readingProgress.chapterId,
      scrollPosition: readingProgress.scrollPosition,
      updatedAt: readingProgress.updatedAt,
      chapterNumber: chapters.chapterNumber,
    })
    .from(readingProgress)
    .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
    .where(and(eq(readingProgress.userId, session.user.id), eq(readingProgress.novelId, novelId)))
    .orderBy(desc(chapters.chapterNumber))
    .limit(1)

  return NextResponse.json(progress ?? null)
}
