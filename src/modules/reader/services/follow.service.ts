import { db } from "@/lib/db"
import { novelFollows, readingProgress } from "@/db/schema/reader"
import { chapters, novels } from "@/db/schema/content"
import { and, desc, eq, sql } from "drizzle-orm"

export async function isFollowing(userId: string, novelId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: novelFollows.userId })
    .from(novelFollows)
    .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, novelId)))
    .limit(1)
  return !!row
}

export async function toggleFollow(userId: string, novelId: string): Promise<boolean> {
  const following = await isFollowing(userId, novelId)
  if (following) {
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, novelId)))
    return false
  } else {
    await db.insert(novelFollows).values({ userId, novelId })
    return true
  }
}

export async function getNovelFollowerIds(novelId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: novelFollows.userId })
    .from(novelFollows)
    .where(eq(novelFollows.novelId, novelId))
  return rows.map((r) => r.userId)
}

export async function getFollowCount(novelId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(novelFollows)
    .where(eq(novelFollows.novelId, novelId))
  return row?.count ?? 0
}

export type LibraryFilter = "ALL" | "READING" | "COMPLETED"

export async function listFollowedNovels(userId: string, filter: LibraryFilter = "ALL") {
  const followed = await db
    .select({
      id: novels.id,
      title: novels.title,
      slug: novels.slug,
      coverUrl: novels.coverImageUrl,
      status: novels.status,
      totalChapters: novels.totalChapters,
      followedAt: novelFollows.createdAt,
    })
    .from(novelFollows)
    .innerJoin(novels, eq(novelFollows.novelId, novels.id))
    .where(eq(novelFollows.userId, userId))
    .orderBy(novelFollows.createdAt)

  const withProgress = await Promise.all(
    followed.map(async (novel) => {
      const [progress] = await db
        .select({
          chapterId: readingProgress.chapterId,
          chapterNumber: chapters.chapterNumber,
        })
        .from(readingProgress)
        .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
        .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, novel.id)))
        .orderBy(desc(chapters.chapterNumber))
        .limit(1)

      const lastChapterNumber = progress?.chapterNumber ?? 0
      const totalChapters = novel.totalChapters || 0
      const progressPercentage = totalChapters > 0 ? Math.min(100, Math.ceil((lastChapterNumber / totalChapters) * 100)) : 0
      const libraryStatus = totalChapters > 0 && lastChapterNumber >= totalChapters ? "COMPLETED" : "READING"

      return {
        ...novel,
        lastChapterId: progress?.chapterId ?? null,
        lastChapterNumber,
        progressPercentage,
        libraryStatus,
      }
    }),
  )

  if (filter === "ALL") return withProgress
  return withProgress.filter((novel) => novel.libraryStatus === filter)
}
