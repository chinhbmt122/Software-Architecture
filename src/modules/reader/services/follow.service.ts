import { db } from "@/lib/db"
import { novelFollows } from "@/db/schema/reader"
import { and, eq, sql } from "drizzle-orm"

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
