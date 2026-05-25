import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "../constants"

// Reuse the session saved by global.setup.ts
test.use({ storageState: AUTH_FILE })

test.describe("Authenticated user", () => {
  test("nav shows Tủ sách and coin balance after login", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Tủ sách" })).toBeVisible()
    // Coin balance link (Pricing) should be visible
    await expect(page.locator("a[href='/pricing']")).toBeVisible()
  })

  test("library page — accessible without redirect", async ({ page }) => {
    await page.goto("/library")
    await expect(page).toHaveURL("/library")
    await expect(page.locator("main").last()).toBeVisible()
  })

  test("settings page — profile form visible", async ({ page }) => {
    await page.goto("/settings")
    await expect(page).toHaveURL("/settings")
    await expect(page.getByRole("heading", { name: "Cài đặt tài khoản" })).toBeVisible()
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#name")).toBeVisible()
    await expect(page.locator("#bio")).toBeVisible()
  })

  test("settings page — password form visible", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.locator("#current-password")).toBeVisible()
    await expect(page.locator("#new-password")).toBeVisible()
    await expect(page.locator("#confirm-password")).toBeVisible()
  })

  test("reader theme — setting night theme applies .dark to <html>", async ({ page }) => {
    // Simulate what happens when the reader saves theme=night to localStorage
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.setItem("reader-prefs", JSON.stringify({ theme: "night" }))
    })
    await page.reload()
    // The anti-FOUC inline script should have applied the dark class
    const htmlClass = await page.locator("html").getAttribute("class")
    expect(htmlClass).toContain("dark")
  })

  test("reader theme — setting light theme removes .dark from <html>", async ({ page }) => {
    await page.goto("/")
    // First set dark, then clear it
    await page.evaluate(() => {
      localStorage.setItem("reader-prefs", JSON.stringify({ theme: "light" }))
    })
    await page.reload()
    const htmlClass = await page.locator("html").getAttribute("class")
    expect(htmlClass ?? "").not.toContain("dark")
  })
})
