import { test, expect } from "@playwright/test"

test.describe("Auth flows", () => {
  test("sign-in page — form renders correctly", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible()
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Quên mật khẩu?" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Đăng ký" })).toBeVisible()
  })

  test("sign-in — wrong credentials shows error", async ({ page }) => {
    await page.goto("/sign-in")
    await page.fill("#email", "notexist@example.com")
    await page.fill("#password", "wrongpassword")
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    // Error paragraph should appear
    await expect(page.locator("p.text-destructive")).toBeVisible({ timeout: 8_000 })
  })

  test("sign-in — valid credentials redirect to home", async ({ page }) => {
    await page.goto("/sign-in")
    await page.fill("#email", process.env.TEST_USER_EMAIL!)
    await page.fill("#password", process.env.TEST_USER_PASSWORD!)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })
  })

  test("forgot-password page — form renders", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.locator("input[type='email']")).toBeVisible()
  })

  test("forgot-password — submitting shows confirmation", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[type='email']").fill("someone@example.com")
    await page.getByRole("button", { name: /Gửi/i }).click()
    // Confirmation message replaces form
    await expect(page.locator("text=/email|thư/i")).toBeVisible({ timeout: 8_000 })
  })

  test("sign-up page — renders registration form", async ({ page }) => {
    await page.goto("/sign-up")
    await expect(page.locator("input[type='email']")).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
  })
})
