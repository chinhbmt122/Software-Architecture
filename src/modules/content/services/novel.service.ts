import { db } from "@/lib/db"
import { novels, genres, tags, novelGenres, novelTags } from "@/db/schema"
import { eq, desc, and, inArray, ilike, or, sql, ne, type SQL } from "drizzle-orm"
import slugify from "slugify"
import { z } from "zod"
import { cache } from "../lib/cache"

export const createNovelSchema = z.object({
  title: z.string().min(1).max(500),
  synopsis: z.string().optional(),
  coverImageUrl: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
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

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function editDistanceAtMostOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length > b.length) i += 1
    else if (b.length > a.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

function fuzzyMatchesNovel(novel: Pick<typeof novels.$inferSelect, "title" | "synopsis">, rawQuery: string) {
  const query = normalizeForSearch(rawQuery).trim()
  if (!query) return true

  const haystack = normalizeForSearch(`${novel.title} ${novel.synopsis ?? ""}`)
  if (haystack.includes(query)) return true

  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean)
  const queryWords = query.split(/\s+/).filter(Boolean)
  return queryWords.every((queryWord) =>
    words.some((word) => word.includes(queryWord) || queryWord.includes(word) || editDistanceAtMostOne(queryWord, word)),
  )
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

  await cache.invalidateNovel(novel.slug)

  return novel
}

export async function updateNovel(id: string, data: UpdateNovelInput) {
  const existing = await getNovelById(id)
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

  if (existing?.slug) await cache.invalidateNovel(existing.slug)
  if (updated?.slug && updated.slug !== existing?.slug) await cache.invalidateNovel(updated.slug)

  return updated
}

export async function deleteNovel(id: string) {
  const existing = await getNovelById(id)
  await db.delete(novels).where(eq(novels.id, id))
  if (existing?.slug) {
    await cache.invalidateNovel(existing.slug)
  }
}

export async function getNovelById(id: string) {
  const [novel] = await db.select().from(novels).where(eq(novels.id, id)).limit(1)
  return novel ?? null
}

export async function getNovelBySlug(slug: string) {
  return cache.getNovel(slug, async () => {
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
  })
}

export async function listNovels(filters: {
  status?: string
  genreId?: number
  search?: string
  isFeatured?: boolean
  sort?: string
  limit?: number
  offset?: number
}) {
  const searchText = filters.search?.trim()
  const baseConditions: SQL[] = []
  if (filters.status) baseConditions.push(eq(novels.status, filters.status as never))
  if (filters.isFeatured !== undefined) baseConditions.push(eq(novels.isFeatured, filters.isFeatured))

  const orderBy =
    filters.sort === "trending" ? [desc(novels.totalViews)] :
      filters.sort === "rating" ? [sql`${novels.avgRating} IS NULL`, desc(novels.avgRating)] :
        filters.sort === "chapters" ? [desc(novels.totalChapters)] :
          [desc(novels.updatedAt)]

  const fetchRows = async (extraCondition?: SQL, limit = filters.limit ?? 20, offset = filters.offset ?? 0) => {
    const conditions = extraCondition ? [...baseConditions, extraCondition] : baseConditions
    if (filters.genreId) {
      return db
        .select({ novel: novels })
        .from(novels)
        .innerJoin(novelGenres, eq(novelGenres.novelId, novels.id))
        .where(
          and(
            eq(novelGenres.genreId, filters.genreId),
            ...(conditions.length ? conditions : [sql`1=1`]),
          ),
        )
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset)
        .then((rows) => rows.map((r) => r.novel))
    }

    return db
      .select()
      .from(novels)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)
  }

  if (searchText) {
    const exactSearch = or(ilike(novels.title, `%${searchText}%`), ilike(novels.synopsis, `%${searchText}%`))
    const exactRows = await fetchRows(exactSearch)
    if (exactRows.length > 0) return exactRows

    const limit = filters.limit ?? 20
    const offset = filters.offset ?? 0
    const candidateLimit = Math.max(200, offset + limit)
    const fuzzyRows = (await fetchRows(undefined, candidateLimit, 0)).filter((novel) =>
      fuzzyMatchesNovel(novel, searchText),
    )
    return fuzzyRows.slice(offset, offset + limit)
  }

  return fetchRows()
}

export async function getTrendingNovels(limit = 10) {
  return cache.getTrending(() =>
    db.select().from(novels).orderBy(desc(novels.totalViews)).limit(limit)
  )
}

export async function getNewArrivals(limit = 10) {
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
