// Backend API tests: UC-21 Curator Manage Novel, UC-22 Curator Manage Chapter
// Reader (test user) gets 403; unauthenticated gets 401
import { test, expect } from "@playwright/test"
import { CURATOR_AUTH_FILE, ADMIN_AUTH_FILE } from "../constants"

let firstNovelId: string
let firstChapterId: string

test.beforeAll(async ({ request }) => {
  const novelsRes = await request.get("/api/novels")
  if (!novelsRes.ok()) return
  const novels: Array<{ id: string }> = await novelsRes.json()
  if (novels.length === 0) return
  firstNovelId = novels[0].id

  const chaptersRes = await request.get(`/api/novels/${firstNovelId}/chapters`)
  if (!chaptersRes.ok()) return
  const chapters: Array<{ id: string }> = await chaptersRes.json()
  if (chapters.length > 0) firstChapterId = chapters[0].id
})

// ── UC-21: Curator Manage Novel — reader gets 403 ────────────────────────────
test.describe("UC-21 Novel Management — reader role (authenticated)", () => {
  test("TC-BE-21-002 novel create returns 403 for reader role", async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: {
        title: "Test Novel",
        slug: "test-novel-playwright",
        synopsis: "A test novel",
        status: "DRAFT",
      },
    })
    expect(res.status()).toBe(403)
  })

  test("TC-BE-21-012 novel PATCH returns 403 for reader role", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.patch(`/api/novels/${firstNovelId}`, {
      data: { title: "Updated Title" },
    })
    expect(res.status()).toBe(403)
  })

  test("TC-BE-21-DELETE returns 403 for reader role", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.delete(`/api/novels/${firstNovelId}`)
    expect(res.status()).toBe(403)
  })
})

test.describe("UC-21 Novel Management — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-21-001 novel create returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: { title: "Test Novel", slug: "test-novel-unauth", synopsis: "Test" },
    })
    expect(res.status()).toBe(401)
  })

  test("TC-BE-21-PATCH returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/novels/any-id", {
      data: { title: "Hacked" },
    })
    expect(res.status()).toBe(401)
  })

  test("TC-BE-21-DELETE returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.delete("/api/novels/any-id")
    expect(res.status()).toBe(401)
  })
})

// ── UC-22: Curator Manage Chapter — reader gets 403 ──────────────────────────
test.describe("UC-22 Chapter Management — reader role (authenticated)", () => {
  test("TC-BE-22-002 chapter create returns 403 for reader role", async ({ request }) => {
    if (!firstNovelId) test.skip()
    const res = await request.post(`/api/novels/${firstNovelId}/chapters`, {
      data: {
        chapterNumber: 999,
        title: "Test Chapter",
        content: "Test content",
        status: "DRAFT",
        isVip: false,
      },
    })
    expect(res.status()).toBe(403)
  })

  test("TC-BE-22-PATCH returns 403 for reader role", async ({ request }) => {
    if (!firstNovelId || !firstChapterId) test.skip()
    const res = await request.patch(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}`,
      {
        data: { title: "Hacked Chapter" },
      },
    )
    expect(res.status()).toBe(403)
  })

  test("TC-BE-22-DELETE returns 403 for reader role", async ({ request }) => {
    if (!firstNovelId || !firstChapterId) test.skip()
    const res = await request.delete(
      `/api/novels/${firstNovelId}/chapters/${firstChapterId}`,
    )
    expect(res.status()).toBe(403)
  })
})

test.describe("UC-22 Chapter Management — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-22-001 chapter create returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/novels/any-id/chapters", {
      data: {
        chapterNumber: 1,
        title: "Unauth Chapter",
        content: "Content",
        status: "DRAFT",
        isVip: false,
      },
    })
    expect(res.status()).toBe(401)
  })

  test("TC-BE-22-PATCH returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/novels/any/chapters/any", {
      data: { title: "Hacked" },
    })
    expect(res.status()).toBe(401)
  })

  test("TC-BE-22-DELETE returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.delete("/api/novels/any/chapters/any")
    expect(res.status()).toBe(401)
  })
})

// ── UC-21: Curator positive paths ────────────────────────────────────────────
test.describe("UC-21 Novel Management — curator role (positive paths)", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })

  let novelId: string

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: { title: `PW Curator Novel ${Date.now()}`, synopsis: "Setup novel", status: "ONGOING" },
    })
    if (res.ok()) novelId = (await res.json()).id
  })

  test("TC-BE-21-003 novel create → 201 for curator", async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: { title: `PW Novel ${Date.now()}`, synopsis: "Test", status: "ONGOING" },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.slug).toMatch(/^[a-z0-9-]+$/)
  })

  test("TC-BE-21-005 slug auto-generated — no spaces, lowercase, hyphenated", async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: { title: `Slug Test Novel ${Date.now()}`, synopsis: "Slug test" },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.slug).toMatch(/^[a-z0-9-]+$/)
    expect(body.slug).not.toContain(" ")
  })

  test("TC-BE-21-007 empty title → 400", async ({ request }) => {
    const res = await request.post("/api/novels", { data: { title: "", synopsis: "Test" } })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-21-012 novel PATCH → 200 for curator", async ({ request }) => {
    if (!novelId) test.skip()
    const res = await request.patch(`/api/novels/${novelId}`, {
      data: { synopsis: "Updated by curator test" },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.synopsis).toBe("Updated by curator test")
  })

  test("TC-BE-21-014 ONGOING novel appears in public browse list", async ({ request }) => {
    if (!novelId) test.skip()
    const res = await request.get("/api/novels")
    expect(res.ok()).toBeTruthy()
    const novels: Array<{ id: string }> = await res.json()
    expect(novels.some((n) => n.id === novelId)).toBeTruthy()
  })
})

// ── UC-22: Curator positive paths ────────────────────────────────────────────
test.describe("UC-22 Chapter Management — curator role (positive paths)", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })

  let novelId: string
  let publishedChapterId: string

  test.beforeAll(async ({ request }) => {
    const novelRes = await request.post("/api/novels", {
      data: { title: `PW Chapter Novel ${Date.now()}`, synopsis: "For chapter tests", status: "ONGOING" },
    })
    if (novelRes.ok()) novelId = (await novelRes.json()).id
  })

  test("TC-BE-22-003 chapter create → 201 for curator", async ({ request }) => {
    if (!novelId) test.skip()
    const res = await request.post(`/api/novels/${novelId}/chapters`, {
      data: { chapterNumber: 1, title: "Chương 1", content: "Nội dung chương đầu.", isVip: false, status: "DRAFT" },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.status).toBe("DRAFT")
  })

  test("TC-BE-22-004 XSS: <script> tag stripped from chapter content on create", async ({ request }) => {
    if (!novelId) test.skip()
    const res = await request.post(`/api/novels/${novelId}/chapters`, {
      data: {
        chapterNumber: 2,
        title: "XSS Test",
        content: "<p>Safe</p><script>alert(1)</script>",
        isVip: false,
        status: "DRAFT",
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.content).not.toMatch(/<script/i)
    expect(body.content).toContain("Safe")
  })

  test("TC-BE-22-005 XSS: onclick attribute stripped from chapter content", async ({ request }) => {
    if (!novelId) test.skip()
    const res = await request.post(`/api/novels/${novelId}/chapters`, {
      data: {
        chapterNumber: 3,
        title: "onclick Test",
        content: '<p onclick="alert(1)">Text</p>',
        isVip: false,
        status: "DRAFT",
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.content).not.toContain("onclick")
  })

  test("TC-BE-22-009 DRAFT → PUBLISHED increments totalChapters", async ({ request }) => {
    if (!novelId) test.skip()
    const beforeRes = await request.get(`/api/novels/${novelId}`)
    const before = await beforeRes.json()
    const countBefore = before.totalChapters ?? 0

    const res = await request.post(`/api/novels/${novelId}/chapters`, {
      data: { chapterNumber: 10, title: "Published Chapter", content: "Published content.", isVip: false, status: "PUBLISHED" },
    })
    expect(res.status()).toBe(201)
    publishedChapterId = (await res.json()).id

    const afterRes = await request.get(`/api/novels/${novelId}`)
    const after = await afterRes.json()
    expect(after.totalChapters).toBe(countBefore + 1)
  })

  test("TC-BE-22-010 PUBLISHED → DRAFT decrements totalChapters", async ({ request }) => {
    if (!novelId) test.skip()
    // Create a published chapter to demote
    const createRes = await request.post(`/api/novels/${novelId}/chapters`, {
      data: { chapterNumber: 11, title: "To Be Drafted", content: "Will be drafted.", isVip: false, status: "PUBLISHED" },
    })
    if (!createRes.ok()) test.skip()
    const chapter = await createRes.json()

    const beforeRes = await request.get(`/api/novels/${novelId}`)
    const countBefore = (await beforeRes.json()).totalChapters

    const patchRes = await request.patch(`/api/novels/${novelId}/chapters/${chapter.id}`, {
      data: { status: "DRAFT" },
    })
    expect(patchRes.status()).toBe(200)

    const afterRes = await request.get(`/api/novels/${novelId}`)
    expect((await afterRes.json()).totalChapters).toBe(countBefore - 1)
  })
})

// ── UC-21: Admin can also create novels ───────────────────────────────────────
test.describe("UC-21 Novel Management — admin role (positive paths)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE })

  test("TC-BE-21-004 novel create → 201 for admin role", async ({ request }) => {
    const res = await request.post("/api/novels", {
      data: { title: `PW Admin Novel ${Date.now()}`, synopsis: "Admin created", status: "ONGOING" },
    })
    expect(res.status()).toBe(201)
    expect((await res.json()).id).toBeTruthy()
  })
})

// ── XSS Prevention ────────────────────────────────────────────────────────────
test.describe("UC-22 XSS Prevention — chapter content API (chapter GET)", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })

  test("TC-BE-22-004 chapter content returned does not contain raw script tags", async ({ request }) => {
    const novelRes = await request.post("/api/novels", {
      data: { title: `XSS GET Test ${Date.now()}`, synopsis: "XSS test", status: "ONGOING" },
    })
    if (!novelRes.ok()) test.skip()
    const novel = await novelRes.json()

    const chapterRes = await request.post(`/api/novels/${novel.id}/chapters`, {
      data: { chapterNumber: 1, title: "XSS GET Test", content: "<p>Clean</p><script>alert(1)</script>", isVip: false, status: "PUBLISHED" },
    })
    if (!chapterRes.ok()) test.skip()
    const chapter = await chapterRes.json()

    const getRes = await request.get(`/api/novels/${novel.id}/chapters/${chapter.id}`)
    if (getRes.ok()) {
      const data = await getRes.json()
      expect(data.content ?? "").not.toMatch(/<script[\s>]/i)
    }
  })
})
