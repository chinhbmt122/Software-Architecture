import { db } from "@/lib/db"
import { novels, chapters } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const novelList = await db
    .select({ slug: novels.slug, updatedAt: novels.updatedAt })
    .from(novels)

  const chapterRows = await db
    .select({
      novelSlug: novels.slug,
      chapterNumber: chapters.chapterNumber,
      updatedAt: chapters.updatedAt,
    })
    .from(chapters)
    .innerJoin(novels, eq(chapters.novelId, novels.id))
    .where(eq(chapters.status, "PUBLISHED"))

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/novels`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...novelList.map((n) => ({
      url: `${BASE}/novels/${n.slug}`,
      lastModified: n.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...chapterRows.map((c) => ({
      url: `${BASE}/novels/${c.novelSlug}/chapters/${c.chapterNumber}`,
      lastModified: c.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]
}
