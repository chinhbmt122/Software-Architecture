import { test, expect } from "@playwright/test"

test.describe("Public pages (unauthenticated)", () => {
  test("home page — branding and sections visible", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/NovelHub/)
    await expect(page.getByRole("link", { name: "NovelHub" })).toBeVisible()
    // At least one section heading ("Thịnh hành" or "Mới cập nhật") should appear
    const sections = page.locator("h2")
    await expect(sections.first()).toBeVisible()
  })

  test("home page — nav links visible", async ({ page }) => {
    await page.goto("/")
    // Scope to navigation to avoid matching novel cards that contain the same text
    const nav = page.getByRole("navigation")
    await expect(nav.getByRole("link", { name: "Thể loại" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Bảng xếp hạng" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Hoàn thành" })).toBeVisible()
  })

  test("home page — sign-in / sign-up buttons for guests", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Đăng ký" })).toBeVisible()
  })

  test("novels list — heading, search bar, and status filters", async ({ page }) => {
    await page.goto("/novels")
    await expect(page.getByRole("heading", { name: "Thư viện truyện" })).toBeVisible()
    await expect(page.locator('input[name="q"]')).toBeVisible()
    // Scope filter checks to main content to avoid matching nav links + novel cards
    const main = page.getByRole("main")
    await expect(main.getByRole("link", { name: "Tất cả", exact: true })).toBeVisible()
    await expect(main.getByRole("link", { name: "Đang ra", exact: true })).toBeVisible()
    await expect(main.getByRole("link", { name: "Hoàn thành", exact: true })).toBeVisible()
  })

  test("novels list — search returns results or empty state", async ({ page }) => {
    await page.goto("/novels?q=truyen")
    // Wait for the page to load past the skeleton (heading only appears in the real page)
    await expect(page.getByRole("heading", { name: "Thư viện truyện" })).toBeVisible()
    await expect(page).not.toHaveURL(/error/)
  })

  test("novels list — status filter updates URL", async ({ page }) => {
    await page.goto("/novels")
    // Scope click to main filter chips, not the nav link
    await page.getByRole("main").getByRole("link", { name: "Hoàn thành", exact: true }).click()
    await expect(page).toHaveURL(/status=COMPLETED/)
  })
})
