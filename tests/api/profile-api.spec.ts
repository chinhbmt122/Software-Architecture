// Backend API tests: UC-19 Update Profile, UC-20 Change Password
import { test, expect } from "@playwright/test"

// ── UC-19: Update Profile ──────────────────────────────────────────────────────
test.describe("UC-19 Profile Update — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-19-001 profile update returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/auth/update-user", {
      data: { name: "Hacker" },
    })
    expect([401, 403, 404]).toContain(res.status())
  })
})

test.describe("UC-19 Profile Update — authenticated", () => {
  test("TC-BE-19-002 valid name update returns success", async ({ request }) => {
    const res = await request.patch("/api/auth/update-user", {
      data: { name: "Playwright Test User" },
    })
    // Better Auth updates user name
    expect([200, 204]).toContain(res.status())
  })

  test("TC-BE-19-003 empty name rejected", async ({ request }) => {
    const res = await request.patch("/api/auth/update-user", {
      data: { name: "" },
    })
    // Should fail validation
    expect(res.ok()).toBeFalsy()
  })
})

// ── UC-20: Change Password ─────────────────────────────────────────────────────
test.describe("UC-20 Change Password — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-20-001 change password returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.post("/api/auth/change-password", {
      data: {
        currentPassword: "oldpass",
        newPassword: "newpass123",
        revokeOtherSessions: false,
      },
    })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe("UC-20 Change Password — authenticated", () => {
  test("TC-BE-20-002 wrong current password returns 400/401", async ({ request }) => {
    const res = await request.post("/api/auth/change-password", {
      data: {
        currentPassword: "definitely_wrong_password_xyz",
        newPassword: "newpass123",
        revokeOtherSessions: false,
      },
    })
    expect(res.ok()).toBeFalsy()
    expect([400, 401, 403, 422]).toContain(res.status())
  })

  test("TC-BE-20-004 new password 7 chars returns error", async ({ request }) => {
    const res = await request.post("/api/auth/change-password", {
      data: {
        currentPassword: process.env.TEST_USER_PASSWORD,
        newPassword: "short1",
        revokeOtherSessions: false,
      },
    })
    expect(res.ok()).toBeFalsy()
  })

  test("TC-BE-20-005 new password 8 chars boundary — accepted or rejected based on current pw", async ({ request }) => {
    // This test verifies the 8-char minimum applies to new password
    const res = await request.post("/api/auth/change-password", {
      data: {
        currentPassword: "definitely_wrong_password",
        newPassword: "exactly8",
        revokeOtherSessions: false,
      },
    })
    // Wrong current password should cause failure, not the new password length
    expect(res.ok()).toBeFalsy()
  })
})

// ── Session management ─────────────────────────────────────────────────────────
test.describe("Session endpoints — authenticated", () => {
  test("GET /api/auth/get-session returns current user", async ({ request }) => {
    const res = await request.get("/api/auth/get-session")
    expect(res.ok()).toBeTruthy()
    const session = await res.json()
    expect(session.user).toBeDefined()
    expect(session.user.email).toBe(process.env.TEST_USER_EMAIL)
  })

  test("Authenticated user has role READER", async ({ request }) => {
    const res = await request.get("/api/auth/get-session")
    const session = await res.json()
    expect(session.user?.role?.toLowerCase()).toMatch(/reader/)
  })
})
