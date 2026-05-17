import { db } from "@/lib/db"
import { novels, genres, tags, novelGenres, novelTags } from "@/db/schema"
import { eq, desc, and, inArray, ilike, or, sql, ne } from "drizzle-orm"
import slugify from "slugify"
import { z } from "zod"

export const createNovelSchema = z.object({
  title: z.string().min(1).max(500),
  synopsis: z.string().optional(),
  coverImageUrl: z.url().optional(),
  status: z.enum(["ONGOING", "COMPLETED", "HIATUS", "DROPPED"]).default("ONGOING"),
  originalLanguage: z.enum(["VI", "ZH", "KO", "JA", "EN"]).default("ZH"),
  genreIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
})

export const updateNovelSchema = createNovelSchema.partial().extend({
  isFeatured: z.boolean().optional(),
})

export type CreateNovelInput = z.infer<typeof createNovelSchema>
export type UpdateNovelInput = z.infer<typeof updateNovelSchema>

function makeSlug(title: string) {
  return slugify(title, { lower: true, strict: true, locale: "vi" })
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base
  let counter = 1
  while (true) {
    const existing = await db
      .select({ id: novels.id })
      .from(novels)
      .where(eq(novels.slug, slug))
      .limit(1)
    if (!existing[0] || existing[0].id === excludeId) return slug
    slug = `${base}-${counter++}`
  }
}

export async function createNovel(data: CreateNovelInput, userId: string) {
  const baseSlug = makeSlug(data.title)
  const slug = await ensureUniqueSlug(baseSlug)

  const [novel] = await db
    .insert(novels)
    .values({
      title: data.title,
      slug,
      synopsis: data.synopsis,
      coverImageUrl: data.coverImageUrl,
      status: data.status,
      originalLanguage: data.originalLanguage,
      createdBy: userId,
    })
    .returning()

  if (data.genreIds?.length) {
    await db.insert(novelGenres).values(data.genreIds.map((g) => ({ novelId: novel.id, genreId: g })))
  }
  if (data.tagIds?.length) {
    await db.insert(novelTags).values(data.tagIds.map((t) => ({ novelId: novel.id, tagId: t })))
  }

  const { cache } = await import("../lib/cache")
  await cache.invalidateNovel(novel.slug)

  return novel
}

export async function updateNovel(id: string, data: UpdateNovelInput) {
  const updateData: Partial<typeof novels.$inferInsert> = {}
  if (data.title !== undefined) {
    updateData.title = data.title
    const baseSlug = makeSlug(data.title)
    updateData.slug = await ensureUniqueSlug(baseSlug, id)
  }
  if (data.synopsis !== undefined) updateData.synopsis = data.synopsis
  if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl
  if (data.status !== undefined) updateData.status = data.status
  if (data.originalLanguage !== undefined) updateData.originalLanguage = data.originalLanguage
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured
  updateData.updatedAt = new Date()

  const [updated] = await db.update(novels).set(updateData).where(eq(novels.id, id)).returning()

  if (data.genreIds !== undefined) {
    await db.delete(novelGenres).where(eq(novelGenres.novelId, id))
    if (data.genreIds.length) {
      await db.insert(novelGenres).values(data.genreIds.map((g) => ({ novelId: id, genreId: g })))
    }
  }
  if (data.tagIds !== undefined) {
    await db.delete(novelTags).where(eq(novelTags.novelId, id))
    if (data.tagIds.length) {
      await db.insert(novelTags).values(data.tagIds.map((t) => ({ novelId: id, tagId: t })))
    }
  }

  return updated
}

export async function deleteNovel(id: string) {
  await db.delete(novels).where(eq(novels.id, id))
}

export async function getNovelById(id: string) {
  const [novel] = await db.select().from(novels).where(eq(novels.id, id)).limit(1)
  return novel ?? null
}

export async function getNovelBySlug(slug: string) {
  const [novel] = await db.select().from(novels).where(eq(novels.slug, slug)).limit(1)
  if (!novel) return null

  const novelGenreRows = await db
    .select({ id: genres.id, name: genres.name, slug: genres.slug })
    .from(novelGenres)
    .innerJoin(genres, eq(novelGenres.genreId, genres.id))
    .where(eq(novelGenres.novelId, novel.id))

  const novelTagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(novelTags)
    .innerJoin(tags, eq(novelTags.tagId, tags.id))
    .where(eq(novelTags.novelId, novel.id))

  return { ...novel, genres: novelGenreRows, tags: novelTagRows }
}

export async function listNovels(filters: {
  status?: string
  genreId?: number
  search?: string
  isFeatured?: boolean
  limit?: number
  offset?: number
}) {
  const conditions = []
  if (filters.status) conditions.push(eq(novels.status, filters.status as never))
  if (filters.isFeatured !== undefined) conditions.push(eq(novels.isFeatured, filters.isFeatured))
  if (filters.search) {
    conditions.push(
      or(ilike(novels.title, `%${filters.search}%`), ilike(novels.synopsis, `%${filters.search}%`))
    )
  }

  let query = db
    .select()
    .from(novels)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(novels.updatedAt))
    .limit(filters.limit ?? 20)
    .offset(filters.offset ?? 0)

  if (filters.genreId) {
    return db
      .select({ novel: novels })
      .from(novels)
      .innerJoin(novelGenres, eq(novelGenres.novelId, novels.id))
      .where(
        and(
          eq(novelGenres.genreId, filters.genreId),
          ...(conditions.length ? conditions : [sql`1=1`])
        )
      )
      .orderBy(desc(novels.updatedAt))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0)
      .then((rows) => rows.map((r) => r.novel))
  }

  return query
}

export async function getTrendingNovels(limit = 10) {
  const { cache } = await import("../lib/cache")
  return cache.getTrending(() =>
    db.select().from(novels).orderBy(desc(novels.totalViews)).limit(limit)
  )
}

export async function getNewArrivals(limit = 10) {
  const { cache } = await import("../lib/cache")
  return cache.getNewArrivals(() =>
    db.select().from(novels).orderBy(desc(novels.createdAt)).limit(limit)
  )
}

export async function getFeaturedNovels(limit = 10) {
  return db
    .select()
    .from(novels)
    .where(eq(novels.isFeatured, true))
    .orderBy(desc(novels.updatedAt))
    .limit(limit)
}

export async function incrementNovelViews(novelId: string) {
  await db
    .update(novels)
    .set({ totalViews: sql`${novels.totalViews} + 1` })
    .where(eq(novels.id, novelId))
}

export async function getRecommendedNovels(excludeId: string, genreIds: number[], limit = 6) {
  if (!genreIds.length) return []
  return db
    .selectDistinct({
      id: novels.id,
      title: novels.title,
      slug: novels.slug,
      coverImageUrl: novels.coverImageUrl,
      status: novels.status,
      totalChapters: novels.totalChapters,
      totalViews: novels.totalViews,
    })
    .from(novels)
    .innerJoin(novelGenres, eq(novelGenres.novelId, novels.id))
    .where(and(inArray(novelGenres.genreId, genreIds), ne(novels.id, excludeId)))
    .orderBy(desc(novels.totalViews))
    .limit(limit)
}
