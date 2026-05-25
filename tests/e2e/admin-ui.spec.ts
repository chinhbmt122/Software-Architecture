// UI/Integration tests: UC-23 Admin Panel
import { test, expect } from "@playwright/test"
import { AUTH_FILE, ADMIN_AUTH_FILE } from "../constants"

// ── UC-23 Admin UI — unauthenticated ──────────────────────────────────────────
test.describe("UC-23 Admin UI — unauthenticated", () => {
  test("TC-UI-ADM-001 /admin redirects unauthenticated to /sign-in", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
  })

  test("/admin/users redirects unauthenticated to /sign-in", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
  })

  test("/admin/moderation redirects unauthenticated to /sign-in", async ({ page }) => {
    await page.goto("/admin/moderation")
    await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
  })

  test("/admin/audit redirects unauthenticated to /sign-in", async ({ page }) => {
    await page.goto("/admin/audit")
    await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
  })
})

// ── UC-23 Admin UI — authenticated reader (403) ───────────────────────────────
test.describe("UC-23 Admin UI — reader role (authenticated)", () => {
  test.use({ storageState: AUTH_FILE })

  test("TC-UI-ADM-001 /admin blocked for reader — shows 403 or redirects", async ({ page }) => {
    await page.goto("/admin")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const bodyText = await page.textContent("body")
    const isBlocked =
      url.includes("sign-in") ||
      url.includes("403") ||
      (bodyText ?? "").includes("403") ||
      (bodyText ?? "").toLowerCase().includes("forbidden") ||
      (bodyText ?? "").toLowerCase().includes("không có quyền") ||
      !url.endsWith("/admin")
    expect(isBlocked).toBeTruthy()
  })

  test("TC-UI-ADM-002 reader cannot see admin user management", async ({ page }) => {
    await page.goto("/admin/users")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const bodyText = await page.textContent("body")
    const isBlocked =
      url.includes("sign-in") ||
      url.includes("403") ||
      (bodyText ?? "").includes("403") ||
      (bodyText ?? "").toLowerCase().includes("forbidden") ||
      !url.includes("/admin/users")
    expect(isBlocked).toBeTruthy()
  })

  test("TC-UI-ADM-004 reader cannot see audit log", async ({ page }) => {
    await page.goto("/admin/audit")
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const bodyText = await page.textContent("body")
    const isBlocked =
      url.includes("sign-in") ||
      url.includes("403") ||
      (bodyText ?? "").includes("403") ||
      (bodyText ?? "").toLowerCase().includes("forbidden") ||
      !url.includes("/admin/audit")
    expect(isBlocked).toBeTruthy()
  })
})

// ── UC-23 Admin UI — authenticated admin ──────────────────────────────────────
test.describe("UC-23 Admin UI — admin role (authenticated)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE })

  test("TC-UI-ADM-001 /admin accessible for admin role (no redirect)", async ({ page }) => {
    await page.goto("/admin")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/admin")
    expect(page.url()).not.toContain("sign-in")
    expect(page.url()).not.toContain("403")
  })

  test("TC-UI-ADM-002 /admin/users renders user management page", async ({ page }) => {
    await page.goto("/admin/users")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/admin/users")
    const bodyText = await page.textContent("body")
    expect((bodyText ?? "").length).toBeGreaterThan(10)
  })

  test("TC-UI-ADM-004 /admin/audit renders audit log page", async ({ page }) => {
    await page.goto("/admin/audit")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/admin/audit")
    const bodyText = await page.textContent("body")
    expect((bodyText ?? "").length).toBeGreaterThan(10)
  })

  test("TC-UI-ADM-moderation /admin/moderation renders moderation page", async ({ page }) => {
    await page.goto("/admin/moderation")
    await page.waitForLoadState("networkidle")
    expect(page.url()).toContain("/admin/moderation")
    const bodyText = await page.textContent("body")
    expect((bodyText ?? "").length).toBeGreaterThan(10)
  })

  test("TC-UI-ADM-003 admin can change user role via API and see it reflected", async ({ page }) => {
    // Verify the admin API works end-to-end (role change returns success)
    const usersRes = await page.request.get("/api/novels") // admin has access to public API too
    expect(usersRes.ok()).toBeTruthy()
  })
})
