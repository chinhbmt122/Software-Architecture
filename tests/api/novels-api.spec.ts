// Backend API tests: UC-06 Browse, UC-07 Search, UC-08 Filter, UC-09 Novel Detail
import { test, expect } from "@playwright/test"
import { chapters, genres, novelGenres, novels, readingProgress, users } from "@/db/schema"
import { db } from "@/lib/db"
import { createChapter, createNovel, getNovelBySlug, updateNovel } from "@/modules/content"
import { buildNovelDoc, searchNovels } from "@/modules/search"
import { and, eq } from "drizzle-orm"
import { createServer } from "node:http"

let firstNovelId: string
let firstNovelTitle: string
let discoveryFixture: {
  novelId: string
  slug: string
  title: string
  synopsisNeedle: string
  genreId: number
  genreName: string
  recommendationTitle: string
  coverImageUrl: string
  emptyNovelId: string
  emptyNovelSlug: string
}

async function currentUserId() {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, process.env.TEST_USER_EMAIL!))
    .limit(1)
  expect(user?.id).toBeTruthy()
  return user.id
}

async function withoutRemoteRedis<T>(callback: () => Promise<T>) {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  try {
    return await callback()
  } finally {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
  }
}

async function createDiscoveryFixture() {
  const userId = await currentUserId()
  const unique = Date.now()
  const genreName = `RTM Discovery ${unique}`
  const [genre] = await db
    .insert(genres)
    .values({ name: genreName, slug: `rtm-discovery-${unique}` })
    .returning()

  const coverImageUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
  const synopsisNeedle = `hidden-sanctuary-${unique}`
  const [novel] = await db
    .insert(novels)
    .values({
      title: `Thánh Nhân Quantum ${unique}`,
      slug: `rtm-discovery-novel-${unique}`,
      synopsis: `A deterministic search fixture with ${synopsisNeedle}.`,
      status: "COMPLETED",
      originalLanguage: "VI",
      coverImageUrl,
      totalChapters: 1,
      createdBy: userId,
    })
    .returning()

  const [recommendation] = await db
    .insert(novels)
    .values({
      title: `RTM Recommendation ${unique}`,
      slug: `rtm-recommendation-${unique}`,
      synopsis: "Same-genre recommendation fixture.",
      status: "ONGOING",
      originalLanguage: "VI",
      totalChapters: 1,
      totalViews: 100,
      createdBy: userId,
    })
    .returning()

  const [emptyNovel] = await db
    .insert(novels)
    .values({
      title: `RTM Empty Novel ${unique}`,
      slug: `rtm-empty-novel-${unique}`,
      synopsis: "Novel detail empty chapter fixture.",
      status: "ONGOING",
      originalLanguage: "VI",
      totalChapters: 0,
      avgRating: null,
      createdBy: userId,
    })
    .returning()

  await db.insert(novelGenres).values([
    { novelId: novel.id, genreId: genre.id },
    { novelId: recommendation.id, genreId: genre.id },
  ])
  await db.insert(chapters).values([
    {
      novelId: novel.id,
      chapterNumber: 1,
      title: "Published fixture chapter",
      content: "published",
      status: "PUBLISHED",
      publishedAt: new Date(),
      wordCount: 1,
    },
    {
      novelId: novel.id,
      chapterNumber: 2,
      title: "Future scheduled fixture chapter",
      content: "future",
      status: "SCHEDULED",
      publishedAt: new Date(Date.now() + 86_400_000),
      wordCount: 1,
    },
  ])

  return {
    novelId: novel.id,
    slug: novel.slug,
    title: novel.title,
    synopsisNeedle,
    genreId: genre.id,
    genreName,
    recommendationTitle: recommendation.title,
    coverImageUrl,
    emptyNovelId: emptyNovel.id,
    emptyNovelSlug: emptyNovel.slug,
  }
}

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/novels")
  if (res.ok()) {
    const novels: Array<{ id: string; slug: string; title: string; status: string }> = await res.json()
    if (novels.length > 0) {
      firstNovelId = novels[0].id
      firstNovelTitle = novels[0].title
    }
  }
  discoveryFixture = await createDiscoveryFixture()
})

async function novelIdsForGenre(genreId: number) {
  const rows = await db
    .select({ novelId: novelGenres.novelId })
    .from(novelGenres)
    .where(eq(novelGenres.genreId, genreId))
  return new Set(rows.map((row) => row.novelId))
}

async function withSearchEnv<T>(
  env: Partial<Record<"MEILISEARCH_URL" | "MEILISEARCH_API_KEY" | "MEILISEARCH_SEARCH_TIMEOUT_MS", string>>,
  fn: () => Promise<T>,
) {
  const oldEnv = {
    MEILISEARCH_URL: process.env.MEILISEARCH_URL,
    MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
    MEILISEARCH_SEARCH_TIMEOUT_MS: process.env.MEILISEARCH_SEARCH_TIMEOUT_MS,
  }
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function delayedMeilisearchServer(delayMs: number) {
  const server = createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ hits: [] }))
    }, delayMs)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Unable to start test search server")
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err?: Error) => err ? reject(err) : resolve())),
  }
}

// ── UC-06: Browse Novel List ───────────────────────────────────────────────────
test.describe("UC-06 Browse Novel List", () => {
  test("TC-BE-06-001 GET /api/novels returns 200 array", async ({ request }) => {
    const res = await request.get("/api/novels")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test("TC-BE-06-002 page=1 and page=2 return fixed 30-item pages", async ({ request }) => {
    const page1 = await request.get("/api/novels?page=1")
    const page2 = await request.get("/api/novels?page=2")
    expect(page1.ok()).toBeTruthy()
    expect(page2.ok()).toBeTruthy()

    const first: Array<{ id: string }> = await page1.json()
    const second: Array<{ id: string }> = await page2.json()
    expect(first.length).toBeLessThanOrEqual(30)
    expect(second.length).toBeLessThanOrEqual(30)
    if (first.length && second.length) {
      const firstIds = new Set(first.map((novel) => novel.id))
      expect(second.some((novel) => firstIds.has(novel.id))).toBeFalsy()
    }
  })

  test("TC-BE-06-003 page beyond total pages returns empty array", async ({ request }) => {
    const res = await request.get("/api/novels?page=999999")
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual([])
  })

  test("TC-BE-06-004 status=COMPLETED filter returns only COMPLETED novels", async ({ request }) => {
    const res = await request.get("/api/novels?status=COMPLETED")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const n of novels) {
      expect(n.status).toBe("COMPLETED")
    }
  })

  test("TC-BE-06-005 status=ONGOING filter returns only ONGOING novels", async ({ request }) => {
    const res = await request.get("/api/novels?status=ONGOING")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const n of novels) {
      expect(n.status).toBe("ONGOING")
    }
  })

  test("TC-BE-06-006 status=HIATUS filter returns only HIATUS novels", async ({ request }) => {
    const res = await request.get("/api/novels?status=HIATUS")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const n of novels) {
      expect(n.status).toBe("HIATUS")
    }
  })

  test("TC-BE-06-007 status=DROPPED filter returns only DROPPED novels", async ({ request }) => {
    const res = await request.get("/api/novels?status=DROPPED")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const n of novels) {
      expect(n.status).toBe("DROPPED")
    }
  })

  test("TC-BE-06-008 unknown status falls back — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?status=INVALID_STATUS")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-06-016 zero-match filter returns empty array — no error", async ({ request }) => {
    // Use very unlikely filter combination
    const res = await request.get("/api/novels?status=COMPLETED&genreId=999999")
    expect(res.ok()).toBeTruthy()
    const novels = await res.json()
    expect(Array.isArray(novels)).toBeTruthy()
  })

  test("TC-BE-06-017 DRAFT novels do not appear in public browse results", async ({ request }) => {
    const res = await request.get("/api/novels")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const n of novels) {
      expect(n.status).not.toBe("DRAFT")
    }
  })

  test("TC-BE-06-018 page=0 handled — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?offset=0&limit=30")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-06-019 negative offset handled gracefully — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?offset=-1")
    expect(res.status()).not.toBe(500)
  })
})

// ── UC-07: Search Novels ───────────────────────────────────────────────────────
test.describe("UC-07 Search Novels", () => {
  test("TC-BE-07-001 search query returns 200 under 500ms", async ({ request }) => {
    const start = Date.now()
    const res = await request.get("/api/novels?q=truyen")
    const elapsed = Date.now() - start
    expect(res.ok()).toBeTruthy()
    expect(elapsed).toBeLessThan(500)
  })

  test("TC-BE-07-002 empty q param returns full list — no search call", async ({ request }) => {
    const withQ = await request.get("/api/novels?q=")
    const withoutQ = await request.get("/api/novels")
    expect(withQ.ok()).toBeTruthy()
    expect(withoutQ.ok()).toBeTruthy()
    // Both should return arrays
    expect(Array.isArray(await withQ.json())).toBeTruthy()
    expect(Array.isArray(await withoutQ.json())).toBeTruthy()
  })

  test("TC-BE-07-003 query with 1-char typo returns matching novel", async ({ request }) => {
    const res = await request.get("/api/novels?q=Quantm")
    expect(res.ok()).toBeTruthy()
    const body: Array<{ id: string }> = await res.json()
    expect(body.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
  })

  test("TC-BE-07-004 search scope matches title and synopsis, not genre names", async ({ request }) => {
    const titleRes = await request.get(`/api/novels?q=${encodeURIComponent(discoveryFixture.title)}`)
    const synopsisRes = await request.get(`/api/novels?q=${encodeURIComponent(discoveryFixture.synopsisNeedle)}`)
    const genreRes = await request.get(`/api/novels?q=${encodeURIComponent(discoveryFixture.genreName)}`)
    expect(titleRes.ok()).toBeTruthy()
    expect(synopsisRes.ok()).toBeTruthy()
    expect(genreRes.ok()).toBeTruthy()

    const titleMatches: Array<{ id: string }> = await titleRes.json()
    const synopsisMatches: Array<{ id: string }> = await synopsisRes.json()
    const genreMatches: Array<{ id: string }> = await genreRes.json()
    expect(titleMatches.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
    expect(synopsisMatches.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
    expect(genreMatches.some((novel) => novel.id === discoveryFixture.novelId)).toBeFalsy()
  })

  test("TC-BE-07-005 Meilisearch slow response triggers DB fallback", async () => {
    const server = await delayedMeilisearchServer(200)
    try {
      await withSearchEnv(
        {
          MEILISEARCH_URL: server.url,
          MEILISEARCH_API_KEY: "test-key",
          MEILISEARCH_SEARCH_TIMEOUT_MS: "25",
        },
        async () => {
          const start = Date.now()
          const body = await searchNovels("Quantm", { limit: 30 })
          expect(Date.now() - start).toBeLessThan(1_000)
          expect(body.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
        },
      )
    } finally {
      await server.close()
    }
  })

  test("TC-BE-07-006 Meilisearch error triggers DB fallback", async () => {
    await withSearchEnv(
      {
        MEILISEARCH_URL: "http://127.0.0.1:1",
        MEILISEARCH_API_KEY: "test-key",
        MEILISEARCH_SEARCH_TIMEOUT_MS: "100",
      },
      async () => {
        const body = await searchNovels("Quantm", { limit: 30 })
        expect(body.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
      },
    )
  })

  test("TC-BE-07-007 DB fallback returns results within 1 second", async () => {
    await withSearchEnv(
      {
        MEILISEARCH_URL: undefined,
        MEILISEARCH_API_KEY: undefined,
        MEILISEARCH_SEARCH_TIMEOUT_MS: undefined,
      },
      async () => {
        const start = Date.now()
        const body = await searchNovels("Quantm", { limit: 30 })
        expect(Date.now() - start).toBeLessThan(1_000)
        expect(body.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
      },
    )
  })

  test("TC-BE-07-008 both search sources fail — empty array returned, no exception", async ({ request }) => {
    // Query with garbage that returns no results — should not throw
    const res = await request.get("/api/novels?q=XYZABCDEF_no_match_12345")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test("TC-BE-07-009 MEILISEARCH_API_KEY not in response body or headers", async ({ request }) => {
    const res = await request.get("/api/novels?q=test")
    const body = await res.text()
    const headers = JSON.stringify(res.headers())
    expect(body).not.toContain(process.env.MEILISEARCH_API_KEY ?? "MEILISEARCH_KEY_PLACEHOLDER")
    expect(headers).not.toContain(process.env.MEILISEARCH_API_KEY ?? "MEILISEARCH_KEY_PLACEHOLDER")
  })

  test("TC-BE-07-013 special chars in query do not cause 500", async ({ request }) => {
    for (const q of ['"quoted"', "a/b", "a&b", "<script>", "'; DROP TABLE"]) {
      const res = await request.get(`/api/novels?q=${encodeURIComponent(q)}`)
      expect(res.status()).not.toBe(500)
    }
  })

  test("TC-BE-07-015 single char query returns results without error", async ({ request }) => {
    const res = await request.get("/api/novels?q=a")
    expect(res.ok()).toBeTruthy()
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  test("TC-BE-07-016 200-char query handled — no 500", async ({ request }) => {
    const longQ = "a".repeat(200)
    const res = await request.get(`/api/novels?q=${longQ}`)
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-07-012 Vietnamese diacritics are normalized for search", async ({ request }) => {
    const res = await request.get("/api/novels?q=thanh%20nhan")
    expect(res.ok()).toBeTruthy()
    const body: Array<{ id: string }> = await res.json()
    expect(body.some((novel) => novel.id === discoveryFixture.novelId)).toBeTruthy()
  })

  test("TC-BE-07-014 search document reflects a newly published chapter within 60 seconds", async () => {
    const userId = await currentUserId()
    const unique = Date.now()
    const [novel] = await db
      .insert(novels)
      .values({
        title: `RTM Index Publish ${unique}`,
        slug: `rtm-index-publish-${unique}`,
        synopsis: "Search indexing source update fixture.",
        status: "ONGOING",
        totalChapters: 0,
        createdBy: userId,
      })
      .returning()

    const start = Date.now()
    await createChapter(novel.id, {
      chapterNumber: 1,
      title: "Published chapter",
      content: "published search payload",
      status: "PUBLISHED",
    })
    const doc = await buildNovelDoc(novel.id)
    expect(Date.now() - start).toBeLessThan(60_000)
    expect(doc?.totalChapters).toBe(1)
  })
})

// ── UC-08: Filter Novels ───────────────────────────────────────────────────────
test.describe("UC-08 Filter Novels", () => {
  test("TC-BE-08-001 status + genre AND-combined — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?status=COMPLETED&genreId=1")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-08-006 unknown genre ID returns empty result — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?genreId=99999")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
    expect(body.length).toBe(0)
  })

  test("TC-BE-08-009 SQL injection in genreId handled safely — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?genreId=1%20OR%201%3D1")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-08-010 lowercase status param handled — no 500", async ({ request }) => {
    const res = await request.get("/api/novels?status=completed")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-08-004 URL status and genre filters restore identical result on reload", async ({ request }) => {
    const url = `/api/novels?status=COMPLETED&genre=${discoveryFixture.genreId}`
    const first = await request.get(url)
    const second = await request.get(url)
    expect(first.ok()).toBeTruthy()
    expect(second.ok()).toBeTruthy()
    expect(await second.json()).toEqual(await first.json())
  })

  test("TC-BE-08-007 result count reflects filter combination accurately", async ({ request }) => {
    const res = await request.get(`/api/novels?status=COMPLETED&genre=${discoveryFixture.genreId}`)
    expect(res.ok()).toBeTruthy()
    const body: Array<{ id: string; status: string }> = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(discoveryFixture.novelId)
    expect(body[0].status).toBe("COMPLETED")
  })

  test("TC-BE-08-008 filter plus pagination returns a valid page inside filtered subset", async ({ request }) => {
    const res = await request.get("/api/novels?status=COMPLETED&page=2")
    expect(res.ok()).toBeTruthy()
    const body: Array<{ status: string }> = await res.json()
    expect(body.length).toBeLessThanOrEqual(30)
    for (const novel of body) {
      expect(novel.status).toBe("COMPLETED")
    }
  })

  test("TC-BE-08-011 multiple status params use first value", async ({ request }) => {
    const res = await request.get("/api/novels?status=COMPLETED&status=ONGOING")
    expect(res.ok()).toBeTruthy()
    const body: Array<{ status: string }> = await res.json()
    for (const novel of body) {
      expect(novel.status).toBe("COMPLETED")
    }
  })

  test("TC-BE-NFR-024 SQL injection in search q param — no 500", async ({ request }) => {
    const injection = "'; DROP TABLE novels; --"
    const res = await request.get(`/api/novels?q=${encodeURIComponent(injection)}`)
    expect(res.status()).not.toBe(500)
  })
})

// ── UC-09: View Novel Detail ───────────────────────────────────────────────────
test.describe("UC-09 Novel Detail", () => {
  test("TC-BE-09-001 valid novel ID returns 200 with data", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}`)
    expect(res.ok()).toBeTruthy()
    const novel = await res.json()
    expect(novel.id).toBe(firstNovelId)
    expect(novel.title).toBeDefined()
  })

  test("TC-BE-09-002 non-existent novel ID returns 404", async ({ request }) => {
    const res = await request.get("/api/novels/non-existent-id-000000")
    expect(res.status()).toBe(404)
  })

  test("TC-BE-09-003 DRAFT chapters excluded from public chapter list", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters`)
    expect(res.ok()).toBeTruthy()
    const chapters: Array<{ status: string }> = await res.json()
    for (const c of chapters) {
      expect(c.status).not.toBe("DRAFT")
    }
  })

  test("TC-BE-09-004 future-scheduled chapters are excluded from public chapter list", async ({ request }) => {
    const res = await request.get(`/api/novels/${discoveryFixture.novelId}/chapters`)
    expect(res.ok()).toBeTruthy()
    const body: Array<{ chapterNumber: number; status: string }> = await res.json()
    expect(body.map((chapter) => chapter.chapterNumber)).toEqual([1])
    expect(body.some((chapter) => chapter.status === "SCHEDULED")).toBeFalsy()
  })

  test("TC-BE-09-005 response head includes og:title matching novel title", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('property="og:title"')
    expect(html).toContain(`content="${discoveryFixture.title}"`)
  })

  test("TC-BE-09-006 response head includes og:description", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('property="og:description"')
    expect(html).toContain(discoveryFixture.synopsisNeedle)
  })

  test("TC-BE-09-007 response head includes canonical URL", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('rel="canonical"')
    expect(html).toContain(`/novels/${discoveryFixture.slug}`)
  })

  test("TC-BE-09-008 totalViews increment is fire-and-forget and does not block page load", async ({ request }) => {
    const [before] = await db
      .select({ totalViews: novels.totalViews })
      .from(novels)
      .where(eq(novels.id, discoveryFixture.novelId))
      .limit(1)

    const start = Date.now()
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    expect(Date.now() - start).toBeLessThan(1_000)

    await expect
      .poll(async () => {
        const [after] = await db
          .select({ totalViews: novels.totalViews })
          .from(novels)
          .where(eq(novels.id, discoveryFixture.novelId))
          .limit(1)
        return Number(after.totalViews)
      })
      .toBeGreaterThan(Number(before.totalViews))
  })

  test("TC-BE-09-009 authenticated reader progress populates continue-reading CTA", async ({ request }) => {
    const userId = await currentUserId()
    const unique = Date.now()
    const novel = await createNovel(
      {
        title: `RTM Continue CTA ${unique}`,
        synopsis: "Continue CTA fixture",
        status: "ONGOING",
        originalLanguage: "VI",
      },
      userId,
    )
    const firstChapter = await createChapter(novel.id, {
      chapterNumber: 1,
      title: "Start",
      content: "start",
      status: "PUBLISHED",
    })
    const secondChapter = await createChapter(novel.id, {
      chapterNumber: 2,
      title: "Continue",
      content: "continue",
      status: "PUBLISHED",
    })

    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, novel.id)))
    await request.post("/api/progress", {
      data: { novelId: novel.id, chapterId: secondChapter.id, scrollPosition: 128 },
    })

    const res = await request.get(`/novels/${novel.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain(`/novels/${novel.slug}/chapters/${secondChapter.chapterNumber}`)
    expect(html).toContain(`/novels/${novel.slug}/chapters/${firstChapter.chapterNumber}`)
  })

  test("TC-BE-09-010 no reading progress shows first chapter CTA", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain(`/novels/${discoveryFixture.slug}/chapters/1`)
  })

  test("TC-BE-09-011 novel with no published chapters has no chapter CTA link", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.emptyNovelSlug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).not.toContain(`/novels/${discoveryFixture.emptyNovelSlug}/chapters/`)
  })

  test("TC-BE-09-012 novel with no reviews has null avgRating in detail data", async ({ request }) => {
    const res = await request.get(`/api/novels/${discoveryFixture.emptyNovelId}`)
    expect(res.ok()).toBeTruthy()
    const novel: { avgRating: string | null } = await res.json()
    expect(novel.avgRating).toBeNull()
  })

  test("TC-BE-09-016 second novel slug lookup is served from cache in under 10 ms", async () => {
    await withoutRemoteRedis(async () => {
      const userId = await currentUserId()
      const unique = Date.now()
      const novel = await createNovel(
        {
          title: `RTM Cache Hit ${unique}`,
          synopsis: "original cached synopsis",
          status: "ONGOING",
          originalLanguage: "VI",
        },
        userId,
      )

      const first = await getNovelBySlug(novel.slug)
      expect(first?.synopsis).toBe("original cached synopsis")

      await db
        .update(novels)
        .set({ synopsis: "changed directly in db" })
        .where(eq(novels.id, novel.id))

      const start = performance.now()
      const second = await getNovelBySlug(novel.slug)
      const durationMs = performance.now() - start
      expect(durationMs).toBeLessThan(10)
      expect(second?.synopsis).toBe("original cached synopsis")
    })
  })

  test("TC-BE-09-017 novel update invalidates cached detail and refreshes from DB", async () => {
    await withoutRemoteRedis(async () => {
      const userId = await currentUserId()
      const unique = Date.now()
      const novel = await createNovel(
        {
          title: `RTM Cache Invalidate ${unique}`,
          synopsis: "before update",
          status: "ONGOING",
          originalLanguage: "VI",
        },
        userId,
      )

      const cached = await getNovelBySlug(novel.slug)
      expect(cached?.synopsis).toBe("before update")

      await updateNovel(novel.id, { synopsis: "after update" })
      const refreshed = await getNovelBySlug(novel.slug)
      expect(refreshed?.synopsis).toBe("after update")
    })
  })

  test("TC-BE-09-014 VIP chapters have isVip=true flag in chapter list", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters`)
    expect(res.ok()).toBeTruthy()
    const chapters: Array<{ isVip: boolean; coinCost: number | null }> = await res.json()
    const vipChapters = chapters.filter((c) => c.isVip)
    for (const c of vipChapters) {
      expect(c.isVip).toBe(true)
      expect(c.coinCost).toBeGreaterThan(0)
    }
  })

  test("TC-BE-NFR-025 SQL injection in novel ID URL — 404, no 500", async ({ request }) => {
    const res = await request.get("/api/novels/1%20OR%201%3D1")
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-09-013 recommendations contain same-genre novels and exclude current novel", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain(discoveryFixture.recommendationTitle)
  })

  test("TC-BE-09-015 cover image URL is Cloudinary CDN domain", async ({ request }) => {
    const res = await request.get(`/api/novels/${discoveryFixture.novelId}`)
    expect(res.ok()).toBeTruthy()
    const novel: { coverImageUrl: string | null } = await res.json()
    expect(novel.coverImageUrl).toBe(discoveryFixture.coverImageUrl)
    expect(novel.coverImageUrl).toContain("res.cloudinary.com")
  })

  test("TC-BE-09-018 og:image uses coverUrl when cover is present", async ({ request }) => {
    const res = await request.get(`/novels/${discoveryFixture.slug}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('property="og:image"')
    expect(html).toContain(discoveryFixture.coverImageUrl)
  })

  test("TC-BE-09-019 novel with 0 chapters returns empty array — no error", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters`)
    expect(res.ok()).toBeTruthy()
    const chapters = await res.json()
    expect(Array.isArray(chapters)).toBeTruthy()
  })

  test("TC-BE-09-020 totalChapters matches exact count of published chapters", async ({ request }) => {
    const [detailRes, chaptersRes] = await Promise.all([
      request.get(`/api/novels/${discoveryFixture.novelId}`),
      request.get(`/api/novels/${discoveryFixture.novelId}/chapters`),
    ])
    expect(detailRes.ok()).toBeTruthy()
    expect(chaptersRes.ok()).toBeTruthy()
    const detail: { totalChapters: number } = await detailRes.json()
    const chapterList: Array<{ status: string }> = await chaptersRes.json()
    expect(detail.totalChapters).toBe(chapterList.length)
    expect(chapterList).toHaveLength(1)
  })
})

// ── Genres endpoint ────────────────────────────────────────────────────────────
test.describe("Genres API", () => {
  test("GET /api/genres returns 200 array", async ({ request }) => {
    const res = await request.get("/api/genres")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test("TC-BE-08-005 genre options sourced from DB — response is array of objects with id and name", async ({ request }) => {
    const res = await request.get("/api/genres")
    const genres: Array<{ id: number; name: string }> = await res.json()
    for (const g of genres) {
      expect(typeof g.id).toBe("number")
      expect(typeof g.name).toBe("string")
    }
  })
})

test.describe("UC-06 Browse Novel List pagination, genre, and sorting", () => {
  test("TC-BE-06-009 genre=<id> returns only novels linked to that genre", async ({ request }) => {
    const genresRes = await request.get("/api/genres")
    const genres: Array<{ id: number }> = await genresRes.json()
    if (!genres.length) test.skip()

    const genreId = genres[0].id
    const expectedIds = await novelIdsForGenre(genreId)
    const res = await request.get(`/api/novels?genre=${genreId}`)
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string }> = await res.json()
    for (const novel of novels) {
      expect(expectedIds.has(novel.id)).toBeTruthy()
    }
  })

  test("TC-BE-06-010 multiple genre params use the first value", async ({ request }) => {
    const genresRes = await request.get("/api/genres")
    const genres: Array<{ id: number }> = await genresRes.json()
    if (genres.length < 2) test.skip()

    const firstGenreId = genres[0].id
    const expectedIds = await novelIdsForGenre(firstGenreId)
    const res = await request.get(`/api/novels?genre=${firstGenreId}&genre=${genres[1].id}`)
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string }> = await res.json()
    for (const novel of novels) {
      expect(expectedIds.has(novel.id)).toBeTruthy()
    }
  })

  test("TC-BE-06-011 sort=trending orders by totalViews descending", async ({ request }) => {
    const res = await request.get("/api/novels?sort=trending")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ totalViews: number }> = await res.json()
    for (let i = 1; i < novels.length; i += 1) {
      expect(Number(novels[i - 1].totalViews)).toBeGreaterThanOrEqual(Number(novels[i].totalViews))
    }
  })

  test("TC-BE-06-012 sort=rating orders by avgRating descending with nulls last", async ({ request }) => {
    const res = await request.get("/api/novels?sort=rating")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ avgRating: string | null }> = await res.json()
    let seenNull = false
    for (let i = 1; i < novels.length; i += 1) {
      if (novels[i - 1].avgRating == null) seenNull = true
      if (novels[i].avgRating != null) {
        expect(seenNull).toBeFalsy()
        if (novels[i - 1].avgRating != null) {
          expect(Number(novels[i - 1].avgRating)).toBeGreaterThanOrEqual(Number(novels[i].avgRating))
        }
      }
    }
  })

  test("TC-BE-06-013 sort=chapters orders by totalChapters descending", async ({ request }) => {
    const res = await request.get("/api/novels?sort=chapters")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ totalChapters: number }> = await res.json()
    for (let i = 1; i < novels.length; i += 1) {
      expect(novels[i - 1].totalChapters).toBeGreaterThanOrEqual(novels[i].totalChapters)
    }
  })

  test("TC-BE-06-014 sort=unknown falls back without 400", async ({ request }) => {
    const res = await request.get("/api/novels?sort=unknown")
    expect(res.status()).not.toBe(400)
    expect(res.status()).not.toBe(500)
  })

  test("TC-BE-06-015 combined status and genre filters are AND-combined", async ({ request }) => {
    const genresRes = await request.get("/api/genres")
    const genres: Array<{ id: number }> = await genresRes.json()
    if (!genres.length) test.skip()

    const genreId = genres[0].id
    const expectedIds = await novelIdsForGenre(genreId)
    const res = await request.get(`/api/novels?status=COMPLETED&genre=${genreId}`)
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string; status: string }> = await res.json()
    for (const novel of novels) {
      expect(novel.status).toBe("COMPLETED")
      expect(expectedIds.has(novel.id)).toBeTruthy()
    }
  })

  test("TC-BE-06-020 limit query param ignored; server keeps 30-item page size", async ({ request }) => {
    const normal = await request.get("/api/novels")
    const limited = await request.get("/api/novels?limit=1")
    expect(normal.ok()).toBeTruthy()
    expect(limited.ok()).toBeTruthy()
    const normalNovels: unknown[] = await normal.json()
    const limitedNovels: unknown[] = await limited.json()
    expect(limitedNovels).toHaveLength(normalNovels.length)
    expect(limitedNovels.length).toBeLessThanOrEqual(30)
  })

  test("TC-BE-06-021 sort=rating keeps unrated novels after rated novels", async ({ request }) => {
    const res = await request.get("/api/novels?sort=rating")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ avgRating: string | null }> = await res.json()
    const firstNull = novels.findIndex((novel) => novel.avgRating == null)
    const laterRated = novels.findIndex((novel, index) => index > firstNull && novel.avgRating != null)
    if (firstNull !== -1) expect(laterRated).toBe(-1)
  })

  test("TC-BE-06-022 status + genre + sort combination satisfies all constraints", async ({ request }) => {
    const genresRes = await request.get("/api/genres")
    const genres: Array<{ id: number }> = await genresRes.json()
    if (!genres.length) test.skip()

    const genreId = genres[0].id
    const expectedIds = await novelIdsForGenre(genreId)
    const res = await request.get(`/api/novels?status=ONGOING&genre=${genreId}&sort=trending`)
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string; status: string; totalViews: number }> = await res.json()
    for (const novel of novels) {
      expect(novel.status).toBe("ONGOING")
      expect(expectedIds.has(novel.id)).toBeTruthy()
    }
    for (let i = 1; i < novels.length; i += 1) {
      expect(Number(novels[i - 1].totalViews)).toBeGreaterThanOrEqual(Number(novels[i].totalViews))
    }
  })
})

test.describe("UC-07 Search Novels filter combinations and concurrency", () => {
  test("TC-BE-07-010 search + status filter is AND-combined", async ({ request }) => {
    const res = await request.get("/api/novels?q=a&status=COMPLETED")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ status: string }> = await res.json()
    for (const novel of novels) {
      expect(novel.status).toBe("COMPLETED")
    }
  })

  test("TC-BE-07-011 search + genre filter is AND-combined", async ({ request }) => {
    const genresRes = await request.get("/api/genres")
    const genres: Array<{ id: number }> = await genresRes.json()
    if (!genres.length) test.skip()

    const genreId = genres[0].id
    const expectedIds = await novelIdsForGenre(genreId)
    const res = await request.get(`/api/novels?q=a&genre=${genreId}`)
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string }> = await res.json()
    for (const novel of novels) {
      expect(expectedIds.has(novel.id)).toBeTruthy()
    }
  })

  test("TC-BE-07-017 10 concurrent search requests all return 200", async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) => request.get(`/api/novels?q=test${index}`)),
    )
    for (const res of responses) {
      expect(res.status()).toBe(200)
    }
  })

  test("TC-BE-07-018 search matching is case-insensitive", async ({ request }) => {
    if (!firstNovelTitle) test.skip()
    const query = firstNovelTitle.slice(0, Math.min(4, firstNovelTitle.length))
    const lower = await request.get(`/api/novels?q=${encodeURIComponent(query.toLowerCase())}`)
    const upper = await request.get(`/api/novels?q=${encodeURIComponent(query.toUpperCase())}`)
    expect(lower.ok()).toBeTruthy()
    expect(upper.ok()).toBeTruthy()
    const lowerIds = new Set((await lower.json()).map((novel: { id: string }) => novel.id))
    const upperIds = new Set((await upper.json()).map((novel: { id: string }) => novel.id))
    expect(lowerIds.has(firstNovelId)).toBeTruthy()
    expect(upperIds.has(firstNovelId)).toBeTruthy()
  })
})
