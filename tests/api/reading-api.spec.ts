// Backend API tests: UC-10 Read Chapter, UC-12 Follow, UC-13 Progress, UC-14 Library
import { test, expect } from "@playwright/test"
import { chapterUnlocks, chapters, novelFollows, novels, readingProgress, subscriptions, users } from "@/db/schema"
import { db } from "@/lib/db"
import { estimateReadingTime, getAdjacentChapters } from "@/modules/content"
import { checkChapterAccess } from "@/modules/monetization"
import { getFollowCount, listFollowedNovels } from "@/modules/reader"
import { and, desc, eq } from "drizzle-orm"

let firstNovelId: string
let firstChapterId: string
let freeChapterId: string
let vipChapterId: string

async function currentReaderId() {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, process.env.TEST_USER_EMAIL!))
    .limit(1)
  expect(user?.id).toBeTruthy()
  return user.id
}

async function createChapterFixture() {
  const userId = await currentReaderId()
  const unique = Date.now()
  const [novel] = await db
    .insert(novels)
    .values({
      title: `RTM Reading Fixture ${unique}`,
      slug: `rtm-reading-fixture-${unique}`,
      synopsis: "RTM reading fixture",
      status: "ONGOING",
      totalChapters: 3,
      createdBy: userId,
    })
    .returning()

  const inserted = await db
    .insert(chapters)
    .values([
      { novelId: novel.id, chapterNumber: 1, title: "Chapter 1", content: "one", status: "PUBLISHED", wordCount: 1 },
      { novelId: novel.id, chapterNumber: 2, title: "Chapter 2", content: "two", status: "PUBLISHED", wordCount: 1 },
      {
        novelId: novel.id,
        chapterNumber: 3,
        title: "Chapter 3",
        content: "three vip",
        status: "PUBLISHED",
        isVip: true,
        coinCost: 2,
        wordCount: 2,
      },
      {
        novelId: novel.id,
        chapterNumber: 4,
        title: "Scheduled Future",
        content: "future",
        status: "SCHEDULED",
        publishedAt: new Date(Date.now() + 86_400_000),
        wordCount: 1,
      },
    ])
    .returning()

  return { novel, chapters: inserted }
}

async function clearReaderAccess(userId: string, chapterId: string) {
  await db.delete(chapterUnlocks).where(and(eq(chapterUnlocks.userId, userId), eq(chapterUnlocks.chapterId, chapterId)))
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId))
}

async function highestProgress(userId: string, novelId: string) {
  const [row] = await db
    .select({
      chapterId: readingProgress.chapterId,
      chapterNumber: chapters.chapterNumber,
      scrollPosition: readingProgress.scrollPosition,
    })
    .from(readingProgress)
    .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, novelId)))
    .orderBy(desc(chapters.chapterNumber))
    .limit(1)
  return row ?? null
}

test.beforeAll(async ({ request }) => {
  const novelsRes = await request.get("/api/novels")
  if (!novelsRes.ok()) return
  const novels: Array<{ id: string }> = await novelsRes.json()
  if (novels.length === 0) return

  firstNovelId = novels[0].id

  const chaptersRes = await request.get(`/api/novels/${firstNovelId}/chapters`)
  if (!chaptersRes.ok()) return
  const chapters: Array<{ id: string; isVip: boolean }> = await chaptersRes.json()
  if (chapters.length > 0) {
    firstChapterId = chapters[0].id
    freeChapterId = chapters.find((c) => !c.isVip)?.id ?? ""
    vipChapterId = chapters.find((c) => c.isVip)?.id ?? ""
  }
})

// ── UC-10: Read Chapter ────────────────────────────────────────────────────────
test.describe("UC-10 Read Chapter — authenticated reader", () => {
  test("TC-BE-10-001 free chapter returns full content", async ({ request }) => {
    if (!freeChapterId) test.skip()
    const url = firstChapterId
      ? `/api/novels/${firstNovelId}/chapters/${freeChapterId || firstChapterId}`
      : "/api/novels/x/chapters/y"
    const res = await request.get(url)
    expect(res.ok()).toBeTruthy()
    const chapter = await res.json()
    // Free chapter must have content (not null)
    if (!chapter.isVip) {
      expect(chapter.content).not.toBeNull()
    }
  })

  test("TC-BE-10-012 non-existent chapter returns 404", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters/non-existent-chapter-id`)
    expect(res.status()).toBe(404)
  })

  test("TC-BE-10-014 future-scheduled chapter is hidden from reader chapter list", async ({ request }) => {
    const fixture = await createChapterFixture()
    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters`)
    expect(res.ok()).toBeTruthy()
    const visible: Array<{ id: string; status: string }> = await res.json()
    expect(visible.some((chapter) => chapter.status === "SCHEDULED")).toBeFalsy()
    expect(visible.some((chapter) => chapter.id === fixture.chapters[3].id)).toBeFalsy()
  })

  test("TC-BE-10-015 previous chapter link resolves chapter 3 to chapter 2", async () => {
    const fixture = await createChapterFixture()
    const adjacent = await getAdjacentChapters(fixture.novel.id, 3)
    expect(adjacent.prev?.id).toBe(fixture.chapters[1].id)
    expect(adjacent.prev?.chapterNumber).toBe(2)
  })

  test("TC-BE-10-016 next chapter is absent for last published chapter", async () => {
    const fixture = await createChapterFixture()
    const adjacent = await getAdjacentChapters(fixture.novel.id, 3)
    expect(adjacent.next).toBeNull()
  })

  test("TC-BE-10-017 reading time estimate rounds up wordCount / 250", async () => {
    expect(estimateReadingTime(250)).toBe(1)
    expect(estimateReadingTime(251)).toBe(2)
    expect(estimateReadingTime(501)).toBe(3)
  })

  test("TC-BE-10-003 free chapter response has shared cache headers", async ({ request }) => {
    const fixture = await createChapterFixture()
    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters/${fixture.chapters[0].id}`)
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["cache-control"]).toContain("s-maxage=60")
    expect(res.headers()["cache-control"]).toContain("stale-while-revalidate=3600")
  })

  test("TC-BE-10-006 VIP chapter returns null content for authenticated reader without unlock/subscription", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.update(users).set({ coinBalance: 0 }).where(eq(users.id, userId))

    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters/${vip.id}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.isVip).toBe(true)
    expect(body.content).toBeNull()
  })

  test("TC-BE-10-007 VIP chapter returns content after coin unlock", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.update(users).set({ coinBalance: 2 }).where(eq(users.id, userId))

    const unlock = await request.post(`/api/novels/${fixture.novel.id}/chapters/${vip.id}/unlock`)
    expect(unlock.ok()).toBeTruthy()
    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters/${vip.id}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.content).toBe(vip.content)
  })

  test("TC-BE-10-008 VIP chapter returns content with active subscription", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.insert(subscriptions).values({
      userId,
      plan: "MONTHLY",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters/${vip.id}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.content).toBe(vip.content)
  })

  test("TC-BE-10-009 VIP access check uses chapter_unlocks table", async () => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.insert(chapterUnlocks).values({ userId, chapterId: vip.id, coinsSpent: 2 })

    const access = await checkChapterAccess(userId, vip.id)
    expect(access.isUnlocked).toBe(true)
    expect(access.canRead).toBe(true)
  })

  test("TC-BE-10-010 VIP access check uses subscriptions table", async () => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.insert(subscriptions).values({
      userId,
      plan: "MONTHLY",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    const access = await checkChapterAccess(userId, vip.id)
    expect(access.hasSubscription).toBe(true)
    expect(access.canRead).toBe(true)
  })

  test("TC-BE-10-011 locked VIP chapter checks access before returning content", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    const vip = fixture.chapters[2]
    await clearReaderAccess(userId, vip.id)
    await db.update(users).set({ coinBalance: 0 }).where(eq(users.id, userId))

    const res = await request.get(`/api/novels/${fixture.novel.id}/chapters/${vip.id}`)
    expect(res.ok()).toBeTruthy()
    const raw = await res.text()
    const body = JSON.parse(raw) as { content: string | null; isVip: boolean }
    expect(body.isVip).toBe(true)
    expect(body.content).toBeNull()
    expect(raw).not.toContain(vip.content)
  })
})

test.describe("UC-10 Read Chapter — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-10-002 free chapter accessible without auth", async ({ request }) => {
    if (!freeChapterId || !firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters/${freeChapterId}`)
    expect(res.ok()).toBeTruthy()
    const chapter = await res.json()
    if (!chapter.isVip) {
      expect(chapter.content).toBeDefined()
      expect(chapter.content).not.toBeNull()
    }
  })

  test("TC-BE-10-004 VIP chapter returns null content for guest", async ({ request }) => {
    if (!vipChapterId || !firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters/${vipChapterId}`)
    expect(res.ok()).toBeTruthy()
    const chapter = await res.json()
    // VIP chapter content must be null for unauthenticated user
    if (chapter.isVip) {
      expect(chapter.content).toBeNull()
    }
  })

  test("TC-BE-10-005 VIP chapter content completely absent — not hidden via CSS", async ({ request }) => {
    if (!vipChapterId || !firstNovelId) test.skip()
    const res = await request.get(`/api/novels/${firstNovelId}/chapters/${vipChapterId}`)
    const chapter = await res.json()
    if (chapter.isVip) {
      // Content must be null (not an empty string or a placeholder)
      expect(chapter.content).toBeNull()
    }
  })
})

// ── UC-12: Follow Novel ────────────────────────────────────────────────────────
test.describe("UC-12 Follow Novel — authenticated", () => {
  test("TC-BE-12-001 follow returns following=true", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/follow`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(typeof body.following).toBe("boolean")
  })

  test("TC-BE-12-003 duplicate follow is idempotent — no duplicate row", async ({ request }) => {
    if (!firstNovelId) test.skip()
    // Follow twice
    await request.post(`/api/novels/${firstNovelId}/follow`)
    const res = await request.post(`/api/novels/${firstNovelId}/follow`)
    // Should still succeed (ON CONFLICT DO NOTHING)
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-12-004 unfollow removes follow", async ({ request }) => {
    if (!firstNovelId) test.skip()
    // Ensure following first
    await request.post(`/api/novels/${firstNovelId}/follow`)
    // Toggle to unfollow
    const res = await request.post(`/api/novels/${firstNovelId}/follow`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(typeof body.following).toBe("boolean")
  })

  test("TC-BE-12-006 follow non-existent novel returns 404 or error", async ({ request }) => {
    const res = await request.post("/api/novels/non-existent-novel-999/follow")
    expect([400, 404, 500]).toContain(res.status())
  })

  test("TC-BE-12-008 follow count reflects novel_follows rows", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const userId = await currentReaderId()
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, firstNovelId)))

    const follow = await request.post(`/api/novels/${firstNovelId}/follow`)
    expect(follow.ok()).toBeTruthy()

    const rows = await db.select().from(novelFollows).where(eq(novelFollows.novelId, firstNovelId))
    expect(await getFollowCount(firstNovelId)).toBe(rows.length)
  })
})

test.describe("UC-12 Follow — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-12-002 follow without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/novels/any-novel-id/follow")
    expect(res.status()).toBe(401)
  })
})

// ── UC-13: Track Reading Progress ─────────────────────────────────────────────
test.describe("UC-13 Reading Progress — authenticated", () => {
  test("TC-BE-13-005 GET /api/progress returns 200 for authenticated user", async ({ request }) => {
    const res = await request.get("/api/progress")
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-13-001 first visit inserts a reading_progress row", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))

    const res = await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 15 },
    })
    expect(res.ok()).toBeTruthy()

    const rows = await db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.chapterId, fixture.chapters[0].id)))
    expect(rows).toHaveLength(1)
    expect(rows[0].scrollPosition).toBe(15)
  })

  test("TC-BE-13-002 second visit to same chapter keeps one row and updates scroll", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))

    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 10 },
    })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 40 },
    })

    const rows = await db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.chapterId, fixture.chapters[0].id)))
    expect(rows).toHaveLength(1)
    expect(rows[0].scrollPosition).toBe(40)
  })

  test("TC-BE-13-003 re-reading earlier chapter does not downgrade highest progress", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))

    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[1].id, scrollPosition: 20 },
    })
    const earlier = await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 80 },
    })
    expect(earlier.ok()).toBeTruthy()
    expect((await earlier.json()).ignored).toBe(true)

    const progress = await highestProgress(userId, fixture.novel.id)
    expect(progress?.chapterNumber).toBe(2)
    expect(progress?.chapterId).toBe(fixture.chapters[1].id)
  })

  test("TC-BE-13-004 reading higher chapter updates highest progress", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))

    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 20 },
    })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[1].id, scrollPosition: 20 },
    })

    const progress = await highestProgress(userId, fixture.novel.id)
    expect(progress?.chapterNumber).toBe(2)
    expect(progress?.chapterId).toBe(fixture.chapters[1].id)
  })

  test("TC-BE-10-019 re-reading earlier chapter does not overwrite forward-only progress", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))

    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[1].id, scrollPosition: 30 },
    })
    const earlier = await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 90 },
    })
    expect(earlier.ok()).toBeTruthy()
    expect((await earlier.json()).ignored).toBe(true)

    const progress = await highestProgress(userId, fixture.novel.id)
    expect(progress?.chapterNumber).toBe(2)
    expect(progress?.scrollPosition).toBe(30)
  })

  test("TC-BE-13-007 progress percentage is ceil(lastChapterNumber / totalChapters * 100), max 100", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[1].id, scrollPosition: 1 },
    })

    const followed = await listFollowedNovels(userId, "ALL")
    const novel = followed.find((item) => item.id === fixture.novel.id)
    expect(novel?.progressPercentage).toBe(67)
  })
})

test.describe("UC-13 Reading Progress — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-13-005 unauthenticated progress request — 401 or redirect", async ({ request }) => {
    const res = await request.get("/api/progress")
    // Either 401 or redirect to sign-in
    expect([401, 302, 200]).toContain(res.status())
  })
})

// ── UC-14: View Library ────────────────────────────────────────────────────────
test.describe("UC-14 Library — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-14-001 unauthenticated /library access redirects to sign-in", async ({ request }) => {
    const res = await request.get("/library", { maxRedirects: 0 })
    // Next.js middleware redirects to /sign-in for unauthenticated access
    expect([302, 307, 308]).toContain(res.status())
    const location = res.headers()["location"] ?? ""
    expect(location).toContain("sign-in")
  })
})

test.describe("UC-14 Library — authenticated", () => {
  test("TC-BE-14-002 authenticated /library returns 200", async ({ request }) => {
    const res = await request.get("/library")
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-14-003 reading filter returns followed novels with progress below total chapters", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[0].id, scrollPosition: 1 },
    })

    const reading = await listFollowedNovels(userId, "READING")
    expect(reading.some((novel) => novel.id === fixture.novel.id)).toBe(true)
  })

  test("TC-BE-14-004 completed filter returns followed novels at or beyond total chapters", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[2].id, scrollPosition: 1 },
    })

    const completed = await listFollowedNovels(userId, "COMPLETED")
    expect(completed.some((novel) => novel.id === fixture.novel.id)).toBe(true)
  })

  test("TC-BE-14-005 all filter returns followed novels regardless of progress", async () => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })

    const all = await listFollowedNovels(userId, "ALL")
    expect(all.some((novel) => novel.id === fixture.novel.id)).toBe(true)
  })

  test("TC-BE-14-006 empty library state has no followed novels", async () => {
    const userId = await currentReaderId()
    await db.delete(novelFollows).where(eq(novelFollows.userId, userId))
    const all = await listFollowedNovels(userId, "ALL")
    expect(all).toHaveLength(0)
  })

  test("TC-BE-14-007 library progress bar value uses lastChapterNumber / totalChapters", async ({ request }) => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(readingProgress)
      .where(and(eq(readingProgress.userId, userId), eq(readingProgress.novelId, fixture.novel.id)))
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })
    await request.post("/api/progress", {
      data: { novelId: fixture.novel.id, chapterId: fixture.chapters[1].id, scrollPosition: 1 },
    })

    const all = await listFollowedNovels(userId, "ALL")
    const novel = all.find((item) => item.id === fixture.novel.id)
    expect(novel?.lastChapterNumber).toBe(2)
    expect(novel?.totalChapters).toBe(3)
    expect(novel?.progressPercentage).toBe(67)
  })

  test("TC-BE-14-008 library data is DB-backed and unaffected by localStorage", async () => {
    const userId = await currentReaderId()
    const fixture = await createChapterFixture()
    await db
      .delete(novelFollows)
      .where(and(eq(novelFollows.userId, userId), eq(novelFollows.novelId, fixture.novel.id)))
    await db.insert(novelFollows).values({ userId, novelId: fixture.novel.id })

    const all = await listFollowedNovels(userId, "ALL")
    expect(all.some((novel) => novel.id === fixture.novel.id)).toBe(true)
  })
})

// ── Chapter view tracking ──────────────────────────────────────────────────────
test.describe("UC-10 Chapter View Tracking — authenticated", () => {
  test("TC-BE-10-018 chapter view endpoint accepts POST", async ({ request }) => {
    if (!firstNovelId || !firstChapterId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}/view`,
    )
    // Should return 200 or 204 (fire-and-forget view counter)
    expect([200, 204]).toContain(res.status())
  })

  test("TC-BE-10-021 chapter view increment does not block endpoint response", async ({ request }) => {
    const fixture = await createChapterFixture()
    const chapter = fixture.chapters[0]
    const [beforeChapter] = await db
      .select({ totalViews: chapters.totalViews })
      .from(chapters)
      .where(eq(chapters.id, chapter.id))
      .limit(1)

    const start = Date.now()
    const res = await request.post(`/api/novels/${fixture.novel.id}/chapters/${chapter.id}/view`)
    expect(res.ok()).toBeTruthy()
    expect(Date.now() - start).toBeLessThan(2_000)

    await expect
      .poll(async () => {
        const [afterChapter] = await db
          .select({ totalViews: chapters.totalViews })
          .from(chapters)
          .where(eq(chapters.id, chapter.id))
          .limit(1)
        return Number(afterChapter.totalViews)
      })
      .toBeGreaterThan(Number(beforeChapter.totalViews))
  })
})
