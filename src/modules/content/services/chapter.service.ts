import { db } from "@/lib/db"
import { chapters, novels } from "@/db/schema"
import { eq, and, lt, gt, asc, desc, or, lte, sql } from "drizzle-orm"
import { z } from "zod"

export const createChapterSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1).max(500),
  content: z.string().default(""),
  isVip: z.boolean().default(false),
  coinCost: z.number().int().min(0).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]).default("DRAFT"),
  publishedAt: z.string().datetime().optional().nullable(),
})

export const updateChapterSchema = createChapterSchema.partial()

export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length
}

export async function createChapter(novelId: string, data: CreateChapterInput) {
  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : null
  const status =
    data.status === "PUBLISHED" && !publishedAt
      ? "PUBLISHED"
      : data.status === "SCHEDULED" && publishedAt
        ? "SCHEDULED"
        : data.status

  const [chapter] = await db
    .insert(chapters)
    .values({
      novelId,
      chapterNumber: data.chapterNumber,
      title: data.title,
      content: data.content,
      wordCount: countWords(data.content),
      isVip: data.isVip,
      coinCost: data.isVip ? (data.coinCost ?? 1) : null,
      status,
      publishedAt,
    })
    .returning()

  if (status === "PUBLISHED") {
    await db
      .update(novels)
      .set({ totalChapters: sql`${novels.totalChapters} + 1`, updatedAt: new Date() })
      .where(eq(novels.id, novelId))
  }

  return chapter
}

export async function updateChapter(id: string, data: UpdateChapterInput) {
  const [existing] = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
  if (!existing) return null

  const updateData: Partial<typeof chapters.$inferInsert> = {}
  if (data.chapterNumber !== undefined) updateData.chapterNumber = data.chapterNumber
  if (data.title !== undefined) updateData.title = data.title
  if (data.content !== undefined) {
    updateData.content = data.content
    updateData.wordCount = countWords(data.content)
  }
  if (data.isVip !== undefined) {
    updateData.isVip = data.isVip
    updateData.coinCost = data.isVip ? (data.coinCost ?? 1) : null
  }
  if (data.status !== undefined) updateData.status = data.status
  if (data.publishedAt !== undefined) {
    updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null
  }
  updateData.updatedAt = new Date()

  const [updated] = await db.update(chapters).set(updateData).where(eq(chapters.id, id)).returning()

  // Keep totalChapters in sync when publish status changes
  const wasPublished = existing.status === "PUBLISHED"
  const isNowPublished = (updateData.status ?? existing.status) === "PUBLISHED"
  if (!wasPublished && isNowPublished) {
    await db
      .update(novels)
      .set({ totalChapters: sql`${novels.totalChapters} + 1`, updatedAt: new Date() })
      .where(eq(novels.id, existing.novelId))
  } else if (wasPublished && !isNowPublished) {
    await db
      .update(novels)
      .set({ totalChapters: sql`${novels.totalChapters} - 1`, updatedAt: new Date() })
      .where(eq(novels.id, existing.novelId))
  }

  const { cache } = await import("../lib/cache")
  await cache.invalidateChapter(`${existing.novelId}:${existing.chapterNumber}`)

  return updated
}

export async function deleteChapter(id: string) {
  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
  if (!chapter) return
  await db.delete(chapters).where(eq(chapters.id, id))
  if (chapter.status === "PUBLISHED") {
    await db
      .update(novels)
      .set({ totalChapters: sql`${novels.totalChapters} - 1`, updatedAt: new Date() })
      .where(eq(novels.id, chapter.novelId))
  }
  const { cache } = await import("../lib/cache")
  await cache.invalidateChapter(`${chapter.novelId}:${chapter.chapterNumber}`)
}

export async function getChapterById(id: string) {
  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
  return chapter ?? null
}

// Returns chapter visible to readers (published or scheduled+past), cached 24h
export async function getPublishedChapterByNumber(novelId: string, chapterNumber: number) {
  const { cache } = await import("../lib/cache")
  return cache.getChapter(`${novelId}:${chapterNumber}`, async () => {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.novelId, novelId),
          eq(chapters.chapterNumber, chapterNumber),
          or(
            eq(chapters.status, "PUBLISHED"),
            and(eq(chapters.status, "SCHEDULED"), lte(chapters.publishedAt, new Date()))
          )
        )
      )
      .limit(1)
    return chapter ?? null
  })
}

export async function listChaptersByNovel(novelId: string, includeUnpublished = false) {
  const conditions = [eq(chapters.novelId, novelId)]
  if (!includeUnpublished) {
    conditions.push(
      or(
        eq(chapters.status, "PUBLISHED"),
        and(eq(chapters.status, "SCHEDULED"), lte(chapters.publishedAt, new Date()))
      ) as never
    )
  }
  return db
    .select()
    .from(chapters)
    .where(and(...conditions))
    .orderBy(asc(chapters.chapterNumber))
}

export async function getAdjacentChapters(novelId: string, chapterNumber: number) {
  const publishedCondition = or(
    eq(chapters.status, "PUBLISHED"),
    and(eq(chapters.status, "SCHEDULED"), lte(chapters.publishedAt, new Date()))
  )

  const [prev] = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber, title: chapters.title })
    .from(chapters)
    .where(and(eq(chapters.novelId, novelId), lt(chapters.chapterNumber, chapterNumber), publishedCondition))
    .orderBy(desc(chapters.chapterNumber))
    .limit(1)

  const [next] = await db
    .select({ id: chapters.id, chapterNumber: chapters.chapterNumber, title: chapters.title })
    .from(chapters)
    .where(and(eq(chapters.novelId, novelId), gt(chapters.chapterNumber, chapterNumber), publishedCondition))
    .orderBy(asc(chapters.chapterNumber))
    .limit(1)

  return { prev: prev ?? null, next: next ?? null }
}

export function estimateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 250)
}

export async function incrementChapterViews(chapterId: string, novelId: string) {
  await Promise.all([
    db
      .update(chapters)
      .set({ totalViews: sql`${chapters.totalViews} + 1` })
      .where(eq(chapters.id, chapterId)),
    db
      .update(novels)
      .set({ totalViews: sql`${novels.totalViews} + 1` })
      .where(eq(novels.id, novelId)),
  ])
}
