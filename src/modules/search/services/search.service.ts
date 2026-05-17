import { Meilisearch } from "meilisearch"
import { db } from "@/lib/db"
import { novels, genres, tags, novelGenres, novelTags } from "@/db/schema"
import { eq, ilike, and, or, sql } from "drizzle-orm"

const INDEX_NAME = "novels"

function getClient(): Meilisearch | null {
  const url = process.env.MEILISEARCH_URL
  const key = process.env.MEILISEARCH_API_KEY
  if (!url) return null
  return new Meilisearch({ host: url, apiKey: key })
}

export interface NovelSearchDoc {
  id: string
  title: string
  synopsis: string | null
  slug: string
  status: string
  originalLanguage: string
  coverImageUrl: string | null
  totalChapters: number
  totalViews: number
  isFeatured: boolean
  genres: string[]
  tags: string[]
}

export async function initSearchIndex() {
  const client = getClient()
  if (!client) return
  const index = client.index(INDEX_NAME)
  await index.updateSettings({
    searchableAttributes: ["title", "synopsis", "genres", "tags"],
    filterableAttributes: ["status", "originalLanguage", "genres", "isFeatured"],
    sortableAttributes: ["totalViews", "totalChapters"],
    displayedAttributes: ["id", "title", "synopsis", "slug", "status", "originalLanguage", "coverImageUrl", "totalChapters", "totalViews", "isFeatured", "genres", "tags"],
  })
}

export async function indexNovel(novel: NovelSearchDoc) {
  const client = getClient()
  if (!client) return
  await client.index(INDEX_NAME).addDocuments([novel], { primaryKey: "id" })
}

export async function removeFromIndex(novelId: string) {
  const client = getClient()
  if (!client) return
  await client.index(INDEX_NAME).deleteDocument(novelId)
}

export async function searchNovels(
  query: string,
  filters?: { status?: string; genreId?: number; limit?: number },
): Promise<NovelSearchDoc[]> {
  const client = getClient()
  const limit = filters?.limit ?? 40

  if (client) {
    try {
      const filterParts: string[] = []
      if (filters?.status) filterParts.push(`status = "${filters.status}"`)
      const result = await client.index(INDEX_NAME).search<NovelSearchDoc>(query, {
        limit,
        filter: filterParts.length ? filterParts.join(" AND ") : undefined,
      })
      return result.hits
    } catch {
      // Fall through to DB fallback
    }
  }

  // DB fallback (ilike)
  const conditions = [ilike(novels.title, `%${query}%`)]
  if (filters?.status) conditions.push(eq(novels.status, filters.status as never))

  const rows = await db
    .select({
      id: novels.id,
      title: novels.title,
      synopsis: novels.synopsis,
      slug: novels.slug,
      status: novels.status,
      originalLanguage: novels.originalLanguage,
      coverImageUrl: novels.coverImageUrl,
      totalChapters: novels.totalChapters,
      totalViews: novels.totalViews,
      isFeatured: novels.isFeatured,
    })
    .from(novels)
    .where(and(...conditions))
    .limit(limit)

  return rows.map((r) => ({
    ...r,
    totalViews: Number(r.totalViews),
    genres: [],
    tags: [],
  }))
}

export async function buildNovelDoc(novelId: string): Promise<NovelSearchDoc | null> {
  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId)).limit(1)
  if (!novel) return null

  const [genreRows, tagRows] = await Promise.all([
    db.select({ name: genres.name }).from(novelGenres).innerJoin(genres, eq(novelGenres.genreId, genres.id)).where(eq(novelGenres.novelId, novelId)),
    db.select({ name: tags.name }).from(novelTags).innerJoin(tags, eq(novelTags.tagId, tags.id)).where(eq(novelTags.novelId, novelId)),
  ])

  return {
    id: novel.id,
    title: novel.title,
    synopsis: novel.synopsis ?? null,
    slug: novel.slug,
    status: novel.status,
    originalLanguage: novel.originalLanguage,
    coverImageUrl: novel.coverImageUrl ?? null,
    totalChapters: novel.totalChapters,
    totalViews: Number(novel.totalViews),
    isFeatured: novel.isFeatured,
    genres: genreRows.map((g) => g.name),
    tags: tagRows.map((t) => t.name),
  }
}
