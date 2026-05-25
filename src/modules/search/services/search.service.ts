import { Meilisearch } from "meilisearch"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { novels, genres, tags, novelGenres, novelTags } from "@/db/schema"
import { listNovels } from "@/modules/content/services/novel.service"
import { eq } from "drizzle-orm"

const INDEX_NAME = "novels"
const DEFAULT_SEARCH_TIMEOUT_MS = 250

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
  avgRating: string | null
  isFeatured: boolean
  genres: string[]
  tags: string[]
}

function searchTimeoutMs() {
  const configured = Number(process.env.MEILISEARCH_SEARCH_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SEARCH_TIMEOUT_MS
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Meilisearch search timed out after ${timeoutMs} ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
    promise.catch(() => null)
  }
}

async function genreNameForFilter(genreId: number) {
  const [row] = await db.select({ name: genres.name }).from(genres).where(eq(genres.id, genreId)).limit(1)
  return row?.name
}

function toSearchDoc(row: Awaited<ReturnType<typeof listNovels>>[number]): NovelSearchDoc {
  return {
    id: row.id,
    title: row.title,
    synopsis: row.synopsis ?? null,
    slug: row.slug,
    status: row.status,
    originalLanguage: row.originalLanguage,
    coverImageUrl: row.coverImageUrl ?? null,
    totalChapters: row.totalChapters,
    totalViews: Number(row.totalViews),
    avgRating: row.avgRating ?? null,
    isFeatured: row.isFeatured,
    genres: [],
    tags: [],
  }
}

export async function initSearchIndex() {
  const client = getClient()
  if (!client) return
  try {
    // createIndex is fire-and-forget on Meilisearch Cloud (async task).
    // Retry updateSettings until the index exists (up to ~5 s).
    await client.createIndex(INDEX_NAME, { primaryKey: "id" }).catch(() => null)
    for (let i = 0; i < 5; i++) {
      try {
        await client.index(INDEX_NAME).updateSettings({
          searchableAttributes: ["title", "synopsis", "genres", "tags"],
          filterableAttributes: ["status", "originalLanguage", "genres", "isFeatured"],
          sortableAttributes: ["totalViews", "totalChapters"],
          displayedAttributes: ["id", "title", "synopsis", "slug", "status", "originalLanguage", "coverImageUrl", "totalChapters", "totalViews", "isFeatured", "genres", "tags"],
        })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 1_000))
      }
    }
  } catch (err) {
    // Search is non-critical — log and continue rather than crashing the server
    console.warn("[search] Meilisearch init failed (search may be degraded):", (err as Error).message)
  }
}

export async function indexNovel(novel: NovelSearchDoc) {
  const client = getClient()
  if (!client) return
  try {
    await client.index(INDEX_NAME).addDocuments([novel], { primaryKey: "id" })
  } catch (err) {
    logger.warn({ err, novelId: novel.id }, "Meilisearch indexing failed")
  }
}

export async function removeFromIndex(novelId: string) {
  const client = getClient()
  if (!client) return
  try {
    await client.index(INDEX_NAME).deleteDocument(novelId)
  } catch (err) {
    logger.warn({ err, novelId }, "Meilisearch delete failed")
  }
}

export async function searchNovels(
  query: string,
  filters?: { status?: string; genreId?: number; limit?: number; offset?: number },
): Promise<NovelSearchDoc[]> {
  const client = getClient()
  const limit = filters?.limit ?? 40
  const offset = filters?.offset ?? 0
  const normalizedQuery = query.trim()

  if (client && normalizedQuery) {
    try {
      const filterParts: string[] = []
      if (filters?.status) filterParts.push(`status = "${filters.status}"`)
      if (filters?.genreId) {
        const genreName = await genreNameForFilter(filters.genreId)
        if (!genreName) return []
        filterParts.push(`genres = "${genreName.replaceAll('"', '\\"')}"`)
      }
      const result = await withTimeout(
        client.index(INDEX_NAME).search<NovelSearchDoc>(normalizedQuery, {
          limit,
          offset,
          filter: filterParts.length ? filterParts.join(" AND ") : undefined,
        }),
        searchTimeoutMs(),
      )
      return result.hits
    } catch (err) {
      logger.warn({ err, query: normalizedQuery }, "Meilisearch unavailable — falling back to DB search")
    }
  }

  const rows = await listNovels({
    search: normalizedQuery,
    status: filters?.status,
    genreId: filters?.genreId,
    limit,
    offset,
  })
  return rows.map(toSearchDoc)
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
    avgRating: novel.avgRating ?? null,
    isFeatured: novel.isFeatured,
    genres: genreRows.map((g) => g.name),
    tags: tagRows.map((t) => t.name),
  }
}
