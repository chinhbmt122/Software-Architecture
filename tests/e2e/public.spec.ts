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
    await expect(page.getByRole("link", { name: "Thể loại" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Bảng xếp hạng" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Hoàn thành" })).toBeVisible()
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
    await expect(page.getByRole("link", { name: "Tất cả" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Đang ra" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Hoàn thành" })).toBeVisible()
  })

  test("novels list — search returns results or empty state", async ({ page }) => {
    await page.goto("/novels?q=truyen")
    // Either shows novel cards or the "not found" message — no 500 error
    await expect(page.locator("main")).toBeVisible()
    await expect(page).not.toHaveURL(/error/)
  })

  test("novels list — status filter updates URL", async ({ page }) => {
    await page.goto("/novels")
    await page.getByRole("link", { name: "Hoàn thành" }).click()
    await expect(page).toHaveURL(/status=COMPLETED/)
  })
})
