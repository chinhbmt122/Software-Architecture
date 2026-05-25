import { getNovelBySlug, getPublishedChapterByNumber, getAdjacentChapters, listChaptersByNovel, estimateReadingTime } from "@/modules/content"
import { checkChapterAccess } from "@/modules/monetization"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ChapterReader } from "./_components/chapter-reader"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { chapterUnlocks } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

interface Props {
  params: Promise<{ slug: string; number: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, number } = await params
  const novel = await getNovelBySlug(slug)
  if (!novel) return {}
  const chapter = await getPublishedChapterByNumber(novel.id, Number(number))
  if (!chapter) return {}
  const title = `Chương ${chapter.chapterNumber}: ${chapter.title}`
  const description = `Đọc ${novel.title} - Chương ${chapter.chapterNumber}: ${chapter.title} tại NovelHub.`
  return {
    title,
    description,
    alternates: { canonical: `/novels/${slug}/chapters/${number}` },
    openGraph: {
      title,
      description,
      type: "article",
      images: novel.coverImageUrl ? [{ url: novel.coverImageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ChapterPage({ params }: Props) {
  const { slug, number } = await params
  const chapterNumber = Number(number)
  if (isNaN(chapterNumber)) notFound()

  const novel = await getNovelBySlug(slug)
  if (!novel) notFound()

  const [chapter, adjacent, allChapters, session] = await Promise.all([
    getPublishedChapterByNumber(novel.id, chapterNumber),
    getAdjacentChapters(novel.id, chapterNumber),
    listChaptersByNovel(novel.id),
    auth.api.getSession({ headers: await headers() }),
  ])

  if (!chapter) notFound()

  // Check VIP access; strip content server-side if locked
  let isLocked = false
  let coinBalance = 0
  const coinCost = chapter.coinCost ?? 1

  if (chapter.isVip) {
    if (!session) {
      isLocked = true
    } else {
      const access = await checkChapterAccess(session.user.id, chapter.id)
      isLocked = !access.canRead
      coinBalance = access.coinBalance
    }
  }

  let unlockedChapterIds = new Set<string>()
  if (session && allChapters.length > 0) {
    const rows = await db
      .select({ chapterId: chapterUnlocks.chapterId })
      .from(chapterUnlocks)
      .where(and(
        eq(chapterUnlocks.userId, session.user.id),
        inArray(chapterUnlocks.chapterId, allChapters.map((c) => c.id)),
      ))
    unlockedChapterIds = new Set(rows.map((r) => r.chapterId))
  }

  return (
    <ChapterReader
      novel={{ id: novel.id, title: novel.title, slug: novel.slug }}
      chapter={{
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: isLocked ? "" : chapter.content,
        wordCount: chapter.wordCount,
        isVip: chapter.isVip,
      }}
      adjacent={{
        prev: adjacent.prev ? { chapterNumber: adjacent.prev.chapterNumber, title: adjacent.prev.title } : null,
        next: adjacent.next ? { chapterNumber: adjacent.next.chapterNumber, title: adjacent.next.title } : null,
      }}
      allChapters={allChapters.map((c) => ({
        chapterNumber: c.chapterNumber,
        title: c.title,
        isVip: c.isVip,
        isUnlocked: unlockedChapterIds.has(c.id),
      }))}
      userId={session?.user.id}
      readingTimeMin={estimateReadingTime(chapter.wordCount)}
      isLocked={isLocked}
      coinBalance={coinBalance}
      coinCost={coinCost}
    />
  )
}
