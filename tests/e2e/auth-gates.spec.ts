import { test, expect } from "@playwright/test"

// No storageState — all requests are unauthenticated
test.describe("Auth gates (unauthenticated)", () => {
  const PROTECTED = [
    { path: "/admin",    label: "admin dashboard" },
    { path: "/library",  label: "library" },
    { path: "/settings", label: "settings" },
    { path: "/curator",  label: "curator CMS" },
  ]

  for (const { path, label } of PROTECTED) {
    test(`${label} redirects to /sign-in`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/sign-in/, { timeout: 8_000 })
    })
  }

  test("admin page — authenticated non-admin is not shown CMS link", async ({ page }) => {
    // Regular user (reader role) should not see the CMS nav link even if somehow on home
    await page.goto("/sign-in")
    await page.fill("#email", process.env.TEST_USER_EMAIL!)
    await page.fill("#password", process.env.TEST_USER_PASSWORD!)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await expect(page.getByRole("link", { name: "CMS" })).not.toBeVisible()
  })
})
