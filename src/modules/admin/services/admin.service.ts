import { db } from "@/lib/db"
import { users } from "@/db/schema/auth"
import { novels } from "@/db/schema/content"
import { comments, reviews, reports } from "@/db/schema/community"
import { payments } from "@/db/schema/monetization"
import { auditLogs } from "@/db/schema/operations"
import { and, count, desc, eq, gte, ilike, inArray, or, sql, sum } from "drizzle-orm"

const PAGE_SIZE = 25

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const [userCount, novelCount, revenueRow, pendingCount] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(novels),
    db.select({ total: sum(payments.amountVnd) }).from(payments).where(eq(payments.status, "SUCCESS")),
    db.select({ n: count() }).from(reports).where(eq(reports.status, "PENDING")),
  ])
  return {
    userCount: Number(userCount[0]?.n ?? 0),
    novelCount: Number(novelCount[0]?.n ?? 0),
    revenueVnd: Number(revenueRow[0]?.total ?? 0),
    pendingReports: Number(pendingCount[0]?.n ?? 0),
  }
}

// ── Users ──────────────────────────────────────────────────────────────────────

export async function listUsers(q?: string, cursor?: string) {
  const offset = cursor ? Number(cursor) : 0
  const cond = q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)) : undefined
  const rows = await db
    .select()
    .from(users)
    .where(cond)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)
  const hasMore = rows.length > PAGE_SIZE
  return { items: rows.slice(0, PAGE_SIZE), nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }
}

export async function updateUserRole(
  userId: string,
  role: "READER" | "CURATOR" | "ADMIN",
  actorId: string,
) {
  const [before] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  await db.update(users).set({ role }).where(eq(users.id, userId))
  await writeAuditLog(actorId, "UPDATE_USER_ROLE", "USER", undefined, {
    userId,
    oldRole: before?.role,
    newRole: role,
  })
}

export async function updateUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "BANNED",
  actorId: string,
) {
  const [before] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1)
  await db.update(users).set({ status }).where(eq(users.id, userId))
  await writeAuditLog(actorId, "UPDATE_USER_STATUS", "USER", undefined, {
    userId,
    oldStatus: before?.status,
    newStatus: status,
  })
}

// ── Reports ────────────────────────────────────────────────────────────────────

export async function listPendingReports(cursor?: string) {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reporterName: users.name,
      reporterEmail: users.email,
    })
    .from(reports)
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "PENDING"))
    .orderBy(desc(reports.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)

  const commentIds = items.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId)
  const reviewIds = items.filter((r) => r.targetType === "REVIEW").map((r) => r.targetId)

  const [commentRows, reviewRows] = await Promise.all([
    commentIds.length
      ? db.select({ id: comments.id, content: comments.content }).from(comments).where(inArray(comments.id, commentIds))
      : [],
    reviewIds.length
      ? db.select({ id: reviews.id, body: reviews.body }).from(reviews).where(inArray(reviews.id, reviewIds))
      : [],
  ])

  const commentMap = new Map(commentRows.map((c) => [c.id, c.content]))
  const reviewMap = new Map(reviewRows.map((r) => [r.id, r.body]))

  const enriched = items.map((r) => ({
    ...r,
    snippet:
      r.targetType === "COMMENT"
        ? (commentMap.get(r.targetId) ?? null)
        : r.targetType === "REVIEW"
        ? (reviewMap.get(r.targetId) ?? null)
        : null,
  }))

  return { items: enriched, nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }
}

export async function resolveReport(
  reportId: string,
  adminId: string,
  resolution: "RESOLVED" | "DISMISSED",
) {
  await db
    .update(reports)
    .set({ status: resolution, resolvedBy: adminId, updatedAt: new Date() })
    .where(eq(reports.id, reportId))
  await writeAuditLog(adminId, `${resolution}_REPORT`, "REPORT", reportId, { resolution })
}

// ── Hidden content ─────────────────────────────────────────────────────────────

export async function setCommentHidden(commentId: string, hidden: boolean, adminId: string) {
  await db.update(comments).set({ isHidden: hidden }).where(eq(comments.id, commentId))
  await writeAuditLog(adminId, hidden ? "HIDE_COMMENT" : "UNHIDE_COMMENT", "COMMENT", commentId, {})
}

export async function setReviewHidden(reviewId: string, hidden: boolean, adminId: string) {
  await db.update(reviews).set({ isHidden: hidden }).where(eq(reviews.id, reviewId))
  await writeAuditLog(adminId, hidden ? "HIDE_REVIEW" : "UNHIDE_REVIEW", "REVIEW", reviewId, {})
}

export async function listHiddenComments(cursor?: string) {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      authorName: users.name,
      authorId: users.id,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.isHidden, true))
    .orderBy(desc(comments.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)
  const hasMore = rows.length > PAGE_SIZE
  return { items: rows.slice(0, PAGE_SIZE), nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }
}

export async function listHiddenReviews(cursor?: string) {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select({
      id: reviews.id,
      body: reviews.body,
      rating: reviews.rating,
      createdAt: reviews.createdAt,
      authorName: users.name,
      authorId: users.id,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.isHidden, true))
    .orderBy(desc(reviews.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)
  const hasMore = rows.length > PAGE_SIZE
  return { items: rows.slice(0, PAGE_SIZE), nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }
}

// ── Audit log ──────────────────────────────────────────────────────────────────

export async function listAuditLogs(cursor?: string) {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorId: users.id,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)
  const hasMore = rows.length > PAGE_SIZE
  return { items: rows.slice(0, PAGE_SIZE), nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export async function getAnalytics() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const [revenueByMonth, topNovels, newUsersByDay] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${payments.createdAt}), 'YYYY-MM')`,
        total: sum(payments.amountVnd),
      })
      .from(payments)
      .where(and(eq(payments.status, "SUCCESS"), gte(payments.createdAt, sixMonthsAgo)))
      .groupBy(sql`date_trunc('month', ${payments.createdAt})`)
      .orderBy(sql`date_trunc('month', ${payments.createdAt})`),
    db
      .select({ id: novels.id, title: novels.title, slug: novels.slug, totalViews: novels.totalViews })
      .from(novels)
      .orderBy(desc(novels.totalViews))
      .limit(5),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'MM-DD')`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, fourteenDaysAgo))
      .groupBy(sql`date_trunc('day', ${users.createdAt})`)
      .orderBy(sql`date_trunc('day', ${users.createdAt})`),
  ])

  return {
    revenueByMonth: revenueByMonth.map((r) => ({ month: r.month, total: Number(r.total ?? 0) })),
    topNovels,
    newUsersByDay: newUsersByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
  }
}

// ── Audit log ──────────────────────────────────────────────────────────────────

export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | undefined,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({ actorId, action, targetType, targetId, metadata })
}
