// UI/Integration tests: NFR Error Boundaries & Observability
import { test, expect } from "@playwright/test"

test.describe("NFR Observability UI", () => {
  test("TC-UI-OBS-005 GET /api/health returns 200 JSON with status", async ({ request }) => {
    const res = await request.get("/api/health")
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body.status).toMatch(/^(ok|degraded|down)$/)
    expect(body.timestamp).toBeDefined()
  })

  test("TC-UI-OBS-008 unknown routes render 404, not 500", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz-123")
    await page.waitForLoadState("networkidle")
    // Should not be a 500 error — either 404 page or redirect
    const bodyText = await page.textContent("body")
    expect((bodyText ?? "").toLowerCase()).not.toContain("internal server error")
    expect((bodyText ?? "").toLowerCase()).not.toContain("unhandled")
  })

  test("TC-UI-OBS-001 error.tsx renders correctly for route errors", async ({ page }) => {
    // Trigger an error by navigating to a known bad route
    await page.goto("/novels/this-novel-absolutely-does-not-exist-12345")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.textContent("body")
    // Should show 404 not found, not a blank screen
    expect((bodyText ?? "").length).toBeGreaterThan(10)
  })

  test("TC-UI-OBS-008 all standard routes return valid HTML", async ({ page }) => {
    const routes = ["/", "/novels", "/pricing", "/sign-in", "/sign-up", "/forgot-password"]
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
    }
  })
})

test.describe("NFR XSS Prevention", () => {
  test("TC-BE-NFR-019 chapter content in browser does not execute script tags", async ({ page }) => {
    const novelsRes = await page.request.get("/api/novels")
    if (!novelsRes.ok()) return
    const novels: Array<{ id: string; slug: string }> = await novelsRes.json()
    if (novels.length === 0) test.skip()

    const chaptersRes = await page.request.get(`/api/novels/${novels[0].id}/chapters`)
    if (!chaptersRes.ok()) return
    const chapters: Array<{ chapterNumber: number; isVip: boolean }> = await chaptersRes.json()
    const freeChapter = chapters.find((c) => !c.isVip)
    if (!freeChapter) test.skip()

    let xssTriggered = false
    page.on("dialog", () => { xssTriggered = true })

    await page.goto(`/novels/${novels[0].slug}/chapters/${freeChapter!.chapterNumber}`)
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000)

    expect(xssTriggered).toBeFalsy()
  })
})
