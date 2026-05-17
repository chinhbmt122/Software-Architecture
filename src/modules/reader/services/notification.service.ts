import { db } from "@/lib/db"
import { notifications } from "@/db/schema/operations"
import { and, desc, eq, sql } from "drizzle-orm"
import { getNovelFollowerIds } from "./follow.service"

const PAGE_SIZE = 20

export async function fanOutNewChapterNotification(
  novelId: string,
  novelTitle: string,
  chapterId: string,
  chapterNumber: number,
  chapterTitle: string,
) {
  const followerIds = await getNovelFollowerIds(novelId)
  if (!followerIds.length) return

  const title = `${novelTitle} — Chương ${chapterNumber} mới`
  const body = chapterTitle

  await db.insert(notifications).values(
    followerIds.map((userId) => ({
      userId,
      type: "NEW_CHAPTER" as const,
      title,
      body,
      referenceType: "CHAPTER" as const,
      referenceId: chapterId,
    }))
  )
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  referenceType: string
  referenceId: string
  isRead: boolean
  createdAt: Date
}

export async function listNotifications(
  userId: string,
  cursor?: string,
): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)
  return {
    items: items.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      isRead: r.isRead,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? String(offset + items.length) : null,
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
  return row?.count ?? 0
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
}
