import { db } from "@/lib/db"
import { chapterUnlocks, subscriptions } from "@/db/schema/monetization"
import { chapters } from "@/db/schema/content"
import { users } from "@/db/schema/auth"
import { and, eq, gt } from "drizzle-orm"
import { deductCoins } from "./coin.service"

export interface ChapterAccessStatus {
  canRead: boolean
  isUnlocked: boolean
  hasSubscription: boolean
  coinBalance: number
  coinCost: number
}

export async function checkChapterAccess(
  userId: string,
  chapterId: string,
): Promise<ChapterAccessStatus> {
  const [chapter, unlock, subscription, user] = await Promise.all([
    db.select({ isVip: chapters.isVip, coinCost: chapters.coinCost })
      .from(chapters).where(eq(chapters.id, chapterId)).limit(1)
      .then((r) => r[0] ?? null),
    db.select({ userId: chapterUnlocks.userId })
      .from(chapterUnlocks)
      .where(and(eq(chapterUnlocks.userId, userId), eq(chapterUnlocks.chapterId, chapterId)))
      .limit(1)
      .then((r) => r[0] ?? null),
    db.select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "ACTIVE"),
          gt(subscriptions.expiresAt, new Date()),
        )
      )
      .limit(1)
      .then((r) => r[0] ?? null),
    db.select({ coinBalance: users.coinBalance })
      .from(users).where(eq(users.id, userId)).limit(1)
      .then((r) => r[0] ?? null),
  ])

  const isUnlocked = !!unlock
  const hasSubscription = !!subscription
  const coinCost = chapter?.coinCost ?? 1
  const coinBalance = user?.coinBalance ?? 0
  const canRead = !chapter?.isVip || isUnlocked || hasSubscription

  return { canRead, isUnlocked, hasSubscription, coinBalance, coinCost }
}

export async function unlockChapter(userId: string, chapterId: string): Promise<number> {
  const [chapter] = await db
    .select({ isVip: chapters.isVip, coinCost: chapters.coinCost })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1)

  if (!chapter) throw new Error("Chapter not found")
  if (!chapter.isVip) throw new Error("Chapter is not VIP")

  // Idempotent: already unlocked
  const [existing] = await db
    .select({ userId: chapterUnlocks.userId })
    .from(chapterUnlocks)
    .where(and(eq(chapterUnlocks.userId, userId), eq(chapterUnlocks.chapterId, chapterId)))
    .limit(1)
  if (existing) {
    const [user] = await db
      .select({ coinBalance: users.coinBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user?.coinBalance ?? 0
  }

  const coinCost = chapter.coinCost ?? 1
  const newBalance = await deductCoins(userId, coinCost, chapterId)

  await db.insert(chapterUnlocks).values({
    userId,
    chapterId,
    coinsSpent: coinCost,
  })

  return newBalance
}
