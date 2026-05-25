import { db } from "@/lib/db"
import { reviews, reviewVotes } from "@/db/schema/community"
import { novels } from "@/db/schema/content"
import { users } from "@/db/schema/auth"
import { and, avg, desc, eq, sql } from "drizzle-orm"
import sanitizeHtml from "sanitize-html"

const PAGE_SIZE = 20

export interface ReviewWithMeta {
  id: string
  rating: number
  body: string | null
  createdAt: Date
  helpfulCount: number
  author: { id: string; name: string; image: string | null }
  myVote: boolean
}

async function recalcAvgRating(novelId: string) {
  const [row] = await db
    .select({ avg: avg(reviews.rating) })
    .from(reviews)
    .where(and(eq(reviews.novelId, novelId), eq(reviews.isHidden, false)))
  await db
    .update(novels)
    .set({ avgRating: row?.avg ? String(Number(row.avg).toFixed(2)) : null })
    .where(eq(novels.id, novelId))
}

export async function listNovelReviews(
  novelId: string,
  userId: string | null,
  cursor?: string,
): Promise<{ items: ReviewWithMeta[]; nextCursor: string | null }> {
  const offset = cursor ? Number(cursor) : 0
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
      helpfulCount: reviews.helpfulCount,
      authorId: users.id,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.novelId, novelId), eq(reviews.isHidden, false)))
    .orderBy(desc(reviews.helpfulCount), desc(reviews.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)

  let helpfulSet = new Set<string>()
  if (userId && items.length) {
    const votes = await db
      .select({ reviewId: reviewVotes.reviewId })
      .from(reviewVotes)
      .where(
        and(
          eq(reviewVotes.userId, userId),
          sql`${reviewVotes.reviewId} = ANY(ARRAY[${sql.join(items.map((r) => sql`${r.id}::uuid`), sql`, `)}])`
        )
      )
    helpfulSet = new Set(votes.map((v) => v.reviewId))
  }

  return {
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt,
      helpfulCount: r.helpfulCount,
      author: { id: r.authorId, name: r.authorName, image: r.authorImage },
      myVote: helpfulSet.has(r.id),
    })),
    nextCursor: hasMore ? String(offset + items.length) : null,
  }
}

export async function getMyReview(novelId: string, userId: string) {
  const [row] = await db
    .select({ id: reviews.id, rating: reviews.rating, body: reviews.body })
    .from(reviews)
    .where(and(eq(reviews.novelId, novelId), eq(reviews.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function upsertReview(
  novelId: string,
  userId: string,
  rating: number,
  body: string | null,
): Promise<ReviewWithMeta> {
  const sanitizedBody = body ? sanitizeHtml(body, { allowedTags: sanitizeHtml.defaults.allowedTags }) : null
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.novelId, novelId), eq(reviews.userId, userId)))
    .limit(1)

  let review
  if (existing) {
    const [updated] = await db
      .update(reviews)
      .set({ rating, body: sanitizedBody, updatedAt: new Date() })
      .where(eq(reviews.id, existing.id))
      .returning()
    review = updated
  } else {
    const [inserted] = await db
      .insert(reviews)
      .values({ novelId, userId, rating, body: sanitizedBody })
      .returning()
    review = inserted
  }

  await recalcAvgRating(novelId)

  const [author] = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return {
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    author: author!,
    myVote: false,
  }
}

export async function deleteReview(reviewId: string, userId: string): Promise<boolean> {
  const [review] = await db
    .select({ userId: reviews.userId, novelId: reviews.novelId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)
  if (!review || review.userId !== userId) return false
  await db.delete(reviews).where(eq(reviews.id, reviewId))
  await recalcAvgRating(review.novelId)
  return true
}

export async function voteReviewHelpful(reviewId: string, userId: string): Promise<boolean> {
  const [review] = await db
    .select({ userId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (review?.userId === userId) {
    throw new Error("Cannot vote on own review")
  }

  const [existing] = await db
    .select({ reviewId: reviewVotes.reviewId })
    .from(reviewVotes)
    .where(and(eq(reviewVotes.userId, userId), eq(reviewVotes.reviewId, reviewId)))
    .limit(1)

  if (existing) {
    await db
      .delete(reviewVotes)
      .where(and(eq(reviewVotes.userId, userId), eq(reviewVotes.reviewId, reviewId)))
    await db
      .update(reviews)
      .set({ helpfulCount: sql`${reviews.helpfulCount} - 1` })
      .where(eq(reviews.id, reviewId))
    return false
  } else {
    await db.insert(reviewVotes).values({ userId, reviewId, voteType: "UP" })
    await db
      .update(reviews)
      .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
      .where(eq(reviews.id, reviewId))
    return true
  }
}
