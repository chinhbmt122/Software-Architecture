import { db } from "@/lib/db"
import { comments, commentVotes } from "@/db/schema/community"
import { users } from "@/db/schema/auth"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import DOMPurify from "isomorphic-dompurify"

const PAGE_SIZE = 20

export interface CommentWithMeta {
  id: string
  content: string
  createdAt: Date
  upvoteCount: number
  downvoteCount: number
  isPinned: boolean
  parentId: string | null
  author: { id: string; name: string; image: string | null }
  myVote: "UP" | "DOWN" | null
  replies?: CommentWithMeta[]
}

export async function listChapterComments(
  chapterId: string,
  userId: string | null,
  cursor?: string,
): Promise<{ items: CommentWithMeta[]; nextCursor: string | null }> {
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      upvoteCount: comments.upvoteCount,
      downvoteCount: comments.downvoteCount,
      isPinned: comments.isPinned,
      parentId: comments.parentId,
      authorId: users.id,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.chapterId, chapterId), isNull(comments.parentId), eq(comments.isHidden, false)))
    .orderBy(desc(comments.isPinned), desc(comments.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(cursor ? Number(cursor) : 0)

  const hasMore = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)

  // Load replies for visible top-level comments
  const parentIds = items.map((r) => r.id)
  const replyRows = parentIds.length
    ? await db
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          upvoteCount: comments.upvoteCount,
          downvoteCount: comments.downvoteCount,
          isPinned: comments.isPinned,
          parentId: comments.parentId,
          authorId: users.id,
          authorName: users.name,
          authorImage: users.image,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(
          and(
            eq(comments.chapterId, chapterId),
            eq(comments.isHidden, false),
            sql`${comments.parentId} = ANY(ARRAY[${sql.join(parentIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
          )
        )
        .orderBy(comments.createdAt)
    : []

  // Fetch my votes in one query
  let voteMap = new Map<string, "UP" | "DOWN">()
  if (userId && items.length) {
    const allIds = [...items.map((r) => r.id), ...replyRows.map((r) => r.id)]
    const votes = await db
      .select({ commentId: commentVotes.commentId, voteType: commentVotes.voteType })
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.userId, userId),
          sql`${commentVotes.commentId} = ANY(ARRAY[${sql.join(allIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
        )
      )
    voteMap = new Map(votes.map((v) => [v.commentId, v.voteType]))
  }

  function toMeta(r: typeof items[number] | typeof replyRows[number]): CommentWithMeta {
    return {
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      upvoteCount: r.upvoteCount,
      downvoteCount: r.downvoteCount,
      isPinned: r.isPinned,
      parentId: r.parentId ?? null,
      author: { id: r.authorId, name: r.authorName, image: r.authorImage },
      myVote: voteMap.get(r.id) ?? null,
    }
  }

  const replyByParent = new Map<string, CommentWithMeta[]>()
  for (const r of replyRows) {
    const list = replyByParent.get(r.parentId!) ?? []
    list.push(toMeta(r))
    replyByParent.set(r.parentId!, list)
  }

  const result = items.map((r) => ({
    ...toMeta(r),
    replies: replyByParent.get(r.id) ?? [],
  }))

  const offset = (cursor ? Number(cursor) : 0) + items.length
  return { items: result, nextCursor: hasMore ? String(offset) : null }
}

export async function createComment(
  chapterId: string,
  userId: string,
  content: string,
  parentId?: string,
): Promise<CommentWithMeta> {
  const sanitizedContent = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })

  if (parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId, chapterId: comments.chapterId })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1)

    if (!parent || parent.chapterId !== chapterId) {
      throw new Error("Invalid parent comment")
    }

    if (parent.parentId) {
      throw new Error("Nested replies are not allowed")
    }
  }

  const [comment] = await db
    .insert(comments)
    .values({ chapterId, userId, content: sanitizedContent, parentId: parentId ?? null })
    .returning()

  const [author] = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    upvoteCount: 0,
    downvoteCount: 0,
    isPinned: false,
    parentId: comment.parentId ?? null,
    author: author!,
    myVote: null,
    replies: [],
  }
}

export async function voteComment(
  commentId: string,
  userId: string,
  voteType: "UP" | "DOWN",
): Promise<void> {
  const [existing] = await db
    .select({ voteType: commentVotes.voteType })
    .from(commentVotes)
    .where(and(eq(commentVotes.userId, userId), eq(commentVotes.commentId, commentId)))
    .limit(1)

  if (existing?.voteType === voteType) {
    // Toggle off: remove vote and decrement count
    await db.delete(commentVotes)
      .where(and(eq(commentVotes.userId, userId), eq(commentVotes.commentId, commentId)))
    if (voteType === "UP") {
      await db.update(comments).set({ upvoteCount: sql`${comments.upvoteCount} - 1` }).where(eq(comments.id, commentId))
    } else {
      await db.update(comments).set({ downvoteCount: sql`${comments.downvoteCount} - 1` }).where(eq(comments.id, commentId))
    }
  } else if (existing) {
    // Switch from opposite vote
    await db.update(commentVotes).set({ voteType })
      .where(and(eq(commentVotes.userId, userId), eq(commentVotes.commentId, commentId)))
    if (voteType === "UP") {
      await db.update(comments).set({
        upvoteCount: sql`${comments.upvoteCount} + 1`,
        downvoteCount: sql`${comments.downvoteCount} - 1`,
      }).where(eq(comments.id, commentId))
    } else {
      await db.update(comments).set({
        downvoteCount: sql`${comments.downvoteCount} + 1`,
        upvoteCount: sql`${comments.upvoteCount} - 1`,
      }).where(eq(comments.id, commentId))
    }
  } else {
    // New vote
    await db.insert(commentVotes).values({ userId, commentId, voteType })
    if (voteType === "UP") {
      await db.update(comments).set({ upvoteCount: sql`${comments.upvoteCount} + 1` }).where(eq(comments.id, commentId))
    } else {
      await db.update(comments).set({ downvoteCount: sql`${comments.downvoteCount} + 1` }).where(eq(comments.id, commentId))
    }
  }
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const [comment] = await db
    .select({ userId: comments.userId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)
  if (!comment || comment.userId !== userId) return false
  await db.delete(comments).where(eq(comments.id, commentId))
  return true
}
