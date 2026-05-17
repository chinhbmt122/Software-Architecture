import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { Meilisearch } from "meilisearch"
import { novels, genres, tags, novelGenres, novelTags } from "../src/db/schema/content"
import { eq } from "drizzle-orm"

const db = drizzle(neon(process.env.DATABASE_URL!))

const INDEX_NAME = "novels"

async function main() {
  const url = process.env.MEILISEARCH_URL
  const key = process.env.MEILISEARCH_API_KEY
  if (!url) { console.error("MEILISEARCH_URL not set"); process.exit(1) }

  const client = new Meilisearch({ host: url, apiKey: key })
  const index = client.index(INDEX_NAME)

  // Apply index settings first
  await index.updateSettings({
    searchableAttributes: ["title", "synopsis", "genres", "tags"],
    filterableAttributes: ["status", "originalLanguage", "genres", "isFeatured"],
    sortableAttributes: ["totalViews", "totalChapters"],
    displayedAttributes: ["id", "title", "synopsis", "slug", "status", "originalLanguage", "coverImageUrl", "totalChapters", "totalViews", "isFeatured", "genres", "tags"],
  })
  console.log("✅ Index settings applied")

  // Fetch all novels
  const novelRows = await db.select().from(novels)
  console.log(`📖 Indexing ${novelRows.length} novels…`)

  const docs = await Promise.all(
    novelRows.map(async (novel) => {
      const [genreRows, tagRows] = await Promise.all([
        db.select({ name: genres.name }).from(novelGenres).innerJoin(genres, eq(novelGenres.genreId, genres.id)).where(eq(novelGenres.novelId, novel.id)),
        db.select({ name: tags.name }).from(novelTags).innerJoin(tags, eq(novelTags.tagId, tags.id)).where(eq(novelTags.novelId, novel.id)),
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
    })
  )

  const task = await index.addDocuments(docs, { primaryKey: "id" })
  console.log(`✅ Enqueued task ${task.taskUid} — ${docs.length} documents`)
  console.log("   Meilisearch indexes asynchronously; search will be available within seconds.")
}

main().catch((e) => { console.error(e); process.exit(1) })
