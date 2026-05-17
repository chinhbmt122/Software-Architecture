import { db } from "@/lib/db"
import { genres, tags } from "@/db/schema"
import { eq } from "drizzle-orm"
import slugify from "slugify"

export async function listGenres() {
  return db.select().from(genres).orderBy(genres.sortOrder, genres.name)
}

export async function listTags() {
  return db.select().from(tags).orderBy(tags.name)
}

export async function getOrCreateTag(name: string) {
  const slug = slugify(name, { lower: true, strict: true })
  const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1)
  if (existing[0]) return existing[0]
  const [created] = await db.insert(tags).values({ name, slug }).returning()
  return created
}

export async function getOrCreateGenre(name: string, parentId?: number) {
  const slug = slugify(name, { lower: true, strict: true })
  const existing = await db.select().from(genres).where(eq(genres.slug, slug)).limit(1)
  if (existing[0]) return existing[0]
  const [created] = await db
    .insert(genres)
    .values({ name, slug, parentId: parentId ?? null })
    .returning()
  return created
}
