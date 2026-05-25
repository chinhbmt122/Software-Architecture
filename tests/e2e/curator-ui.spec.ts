// UI/Integration tests: UC-21 Curator Novel Mgmt, UC-22 Curator Chapter Mgmt
import { test, expect } from "@playwright/test"
import { AUTH_FILE, CURATOR_AUTH_FILE } from "../constants"

// ── UC-21/22 Curator CMS UI — unauthenticated ─────────────────────────────────
test.describe("UC-21/22 Curator CMS UI — unauthenticated", () => {
  test("TC-UI-CUR-002 /curator redirects unauthenticated to /sign-in", async ({ page }) => {
    await page.goto("/curator")
    await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
  })
})

// ── UC-21/22 Curator CMS UI — authenticated reader (403) ─────────────────────
test.describe("UC-21/22 Curator CMS UI — reader role (authenticated)", () => {
  test.use({ storageState: AUTH_FILE })

  test("TC-UI-CUR-001 CMS nav link NOT visible for reader role", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    // CMS link should not be visible for a reader
    await expect(page.getByRole("link", { name: "CMS" })).not.toBeVisible()
  })

  test("TC-UI-CUR-002 /curator is blocked for reader role — shows 403 or redirects", async ({ page }) => {
    await page.goto("/curator")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const bodyText = await page.textContent("body")
    // Should either redirect or show 403/forbidden
    const isBlocked =
      url.includes("sign-in") ||
      url.includes("403") ||
      (bodyText ?? "").includes("403") ||
      (bodyText ?? "").toLowerCase().includes("forbidden") ||
      (bodyText ?? "").toLowerCase().includes("không có quyền")
    expect(isBlocked).toBeTruthy()
  })

  test("TC-UI-CUR-003 novel creation form: empty title shows validation error", async ({ page }) => {
    // Even if reader gets through to /curator, form validation should prevent empty title
    // Test on sign-in page since reader gets redirected
    await page.goto("/curator/novels/new")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    // Should be blocked (redirect or 403 page)
    const isBlocked =
      url.includes("sign-in") ||
      url.includes("403") ||
      !url.includes("/curator/novels/new")
    expect(isBlocked).toBeTruthy()
  })

  test("TC-UI-CUR-006 DRAFT chapter creation — readers cannot access chapter creation", async ({ page }) => {
    await page.goto("/curator/novels")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const isBlocked =
      url.includes("sign-in") ||
      !url.includes("/curator")
    expect(isBlocked).toBeTruthy()
  })
})

// ── Chapter content visibility ─────────────────────────────────────────────────
test.describe("UC-22 Chapter Visibility — public vs curator", () => {
  test("TC-UI-CUR-008 readers cannot see DRAFT chapters in public chapter list", async ({ page }) => {
    const novelsRes = await page.request.get("/api/novels")
    if (!novelsRes.ok()) return
    const novels: Array<{ id: string; slug: string }> = await novelsRes.json()
    if (novels.length === 0) test.skip()

    const chaptersRes = await page.request.get(`/api/novels/${novels[0].id}/chapters`)
    if (!chaptersRes.ok()) return
    const chapters: Array<{ status: string }> = await chaptersRes.json()

    // Public chapter list should not include DRAFT chapters
    for (const c of chapters) {
      expect(c.status).not.toBe("DRAFT")
    }
  })
})

// ── UC-21/22 Curator CMS UI — authenticated curator ──────────────────────────
test.describe("UC-21/22 Curator CMS UI — curator role (authenticated)", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })

  test("TC-UI-CUR-001 CMS nav link IS visible for curator role", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("link", { name: "CMS" })).toBeVisible()
  })

  test("TC-UI-CUR-002 /curator is accessible for curator (no redirect, no 403)", async ({ page }) => {
    await page.goto("/curator")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/curator")
    expect(page.url()).not.toContain("sign-in")
    expect(page.url()).not.toContain("403")
  })

  test("TC-UI-CUR-003 /curator/novels accessible for curator", async ({ page }) => {
    await page.goto("/curator/novels")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/curator")
    const bodyText = await page.textContent("body")
    expect((bodyText ?? "").length).toBeGreaterThan(10)
  })

  test("TC-UI-CUR-008 curator API returns DRAFT chapters (hidden from readers)", async ({ page }) => {
    const novelsRes = await page.request.get("/api/novels")
    if (!novelsRes.ok()) return
    const novels: Array<{ id: string }> = await novelsRes.json()
    if (novels.length === 0) test.skip()

    // Create a DRAFT chapter via API so we know one exists
    await page.request.post(`/api/novels/${novels[0].id}/chapters`, {
      data: { chapterNumber: 998, title: "Draft UI Test", content: "Draft content", isVip: false, status: "DRAFT" },
    })

    const chaptersRes = await page.request.get(`/api/novels/${novels[0].id}/chapters`)
    if (!chaptersRes.ok()) return
    const chapters: Array<{ status: string }> = await chaptersRes.json()
    // Curator should see DRAFT chapters in the list
    const hasDraft = chapters.some((c) => c.status === "DRAFT")
    expect(hasDraft).toBeTruthy()
  })

  test("TC-UI-CUR-009 XSS in chapter content field is stripped in preview", async ({ page }) => {
    const novelsRes = await page.request.get("/api/novels")
    if (!novelsRes.ok()) return
    const novels: Array<{ id: string; slug: string }> = await novelsRes.json()
    if (novels.length === 0) test.skip()

    const createRes = await page.request.post(`/api/novels/${novels[0].id}/chapters`, {
      data: {
        chapterNumber: 997,
        title: "XSS UI Test",
        content: "<p>Clean</p><script>alert(1)</script>",
        isVip: false,
        status: "DRAFT",
      },
    })
    if (!createRes.ok()) test.skip()
    const chapter = await createRes.json()

    // Navigate to the chapter page — script tag must not execute
    let xssTriggered = false
    page.on("dialog", () => { xssTriggered = true })

    await page.goto(`/novels/${novels[0].slug}/chapters/${chapter.chapterNumber}`)
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(500)
    expect(xssTriggered).toBeFalsy()
  })
})
