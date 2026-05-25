// Backend API tests: UC-23 Admin Manage System
// Test user has READER role → gets 403 on all admin routes
// Unauthenticated → gets 401
import { test, expect } from "@playwright/test"
import { neon } from "@neondatabase/serverless"
import { ADMIN_AUTH_FILE, CURATOR_AUTH_FILE } from "../constants"

const ADMIN_ROUTES = [
  { method: "patch" as const, path: "/api/admin/users/some-user-id", body: { role: "READER" } },
  { method: "patch" as const, path: "/api/admin/comments/some-comment-id", body: { isHidden: true } },
  { method: "patch" as const, path: "/api/admin/reviews/some-review-id", body: { isHidden: true } },
  { method: "patch" as const, path: "/api/admin/reports/some-report-id", body: { status: "RESOLVED" } },
]

// ── Authenticated reader — gets 403 on all admin routes ──────────────────────
test.describe("UC-23 Admin Routes — reader role (authenticated)", () => {
  for (const { method, path, body } of ADMIN_ROUTES) {
    test(`${method.toUpperCase()} ${path} → 403 for reader`, async ({ request }) => {
      const res = await request[method](path, { data: body })
      expect(res.status()).toBe(403)
    })
  }

  test("TC-BE-23-002 /api/admin/* reader role gets 403", async ({ request }) => {
    const res = await request.patch("/api/admin/users/some-user-id", {
      data: { status: "SUSPENDED" },
    })
    expect(res.status()).toBe(403)
  })

  test("TC-BE-23-003 /api/admin/* curator role not allowed (reader role blocks)", async ({ request }) => {
    // Our test user is reader, not curator. This verifies admin ≠ curator check
    const res = await request.patch("/api/admin/users/some-user-id", {
      data: { role: "CURATOR" },
    })
    expect(res.status()).toBe(403)
  })
})

// ── Unauthenticated — gets 401 on all admin routes ───────────────────────────
test.describe("UC-23 Admin Routes — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const { method, path, body } of ADMIN_ROUTES) {
    test(`${method.toUpperCase()} ${path} → 401 for unauthenticated`, async ({ request }) => {
      const res = await request[method](path, { data: body })
      expect(res.status()).toBe(401)
    })
  }

  test("TC-BE-23-001 /api/admin/* returns 401 for unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/admin/users/some-user-id", {
      data: { status: "SUSPENDED" },
    })
    expect(res.status()).toBe(401)
  })
})

// ── UC-23: Admin positive paths ───────────────────────────────────────────────
test.describe("UC-23 Admin System — admin role (positive paths)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE })

  let victimUserId: string

  test.beforeAll(async () => {
    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_VICTIM_EMAIL!}`
    if (rows[0]) victimUserId = rows[0].id as string
  })

  test("TC-BE-23-004 PATCH /api/admin/users → 200 for admin role", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { role: "READER" },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).success).toBeTruthy()
  })

  test("TC-BE-23-007 role change → 200 + success response", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { role: "CURATOR" },
    })
    expect(res.status()).toBe(200)
    // Restore
    await request.patch(`/api/admin/users/${victimUserId}`, { data: { role: "READER" } })
  })

  test("TC-BE-23-005 user suspension → 200 + success response", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { status: "SUSPENDED" },
    })
    expect(res.status()).toBe(200)
    // Restore
    await request.patch(`/api/admin/users/${victimUserId}`, { data: { status: "ACTIVE" } })
  })

  test("TC-BE-23-005b user ban → 200 + success response", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { status: "BANNED" },
    })
    expect(res.status()).toBe(200)
    // Restore
    await request.patch(`/api/admin/users/${victimUserId}`, { data: { status: "ACTIVE" } })
  })

  test("TC-BE-23-400 invalid role value → 400", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { role: "SUPERUSER" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-23-400b invalid status value → 400", async ({ request }) => {
    if (!victimUserId) test.skip()
    const res = await request.patch(`/api/admin/users/${victimUserId}`, {
      data: { status: "DELETED" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-23-012 suspended user sign-in attempt is blocked", async ({ request }) => {
    if (!victimUserId) test.skip()
    await request.patch(`/api/admin/users/${victimUserId}`, { data: { status: "SUSPENDED" } })

    // Attempt sign-in as the suspended victim (uses admin request context but sign-in ignores existing session)
    const signInRes = await request.post("/api/auth/sign-in/email", {
      data: { email: process.env.TEST_VICTIM_EMAIL!, password: process.env.TEST_VICTIM_PASSWORD! },
    })
    const body = await signInRes.json()
    const isBlocked = !signInRes.ok() || !!(body.error || body.code || body.message?.toLowerCase().includes("suspend"))
    expect(isBlocked).toBeTruthy()

    // Restore
    await request.patch(`/api/admin/users/${victimUserId}`, { data: { status: "ACTIVE" } })
  })
})

// ── UC-23: Curator is also blocked from admin routes ──────────────────────────
test.describe("UC-23 Admin Routes — curator role (gets 403)", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })

  test("TC-BE-23-003 /api/admin/* returns 403 for curator role", async ({ request }) => {
    const res = await request.patch("/api/admin/users/some-id", { data: { role: "READER" } })
    expect(res.status()).toBe(403)
  })
})

// ── Admin user management validations ────────────────────────────────────────
test.describe("UC-23 Admin User Management — body validation (reader 403 before validation)", () => {
  test("PATCH /api/admin/users with invalid role → 403 for reader (auth check comes first)", async ({ request }) => {
    const res = await request.patch("/api/admin/users/some-user-id", {
      data: { role: "SUPERUSER" }, // invalid role
    })
    // Reader gets 403 before body validation
    expect(res.status()).toBe(403)
  })

  test("PATCH /api/admin/users with invalid status → 403 for reader (auth check comes first)", async ({ request }) => {
    const res = await request.patch("/api/admin/users/some-user-id", {
      data: { status: "DELETED" }, // invalid status
    })
    expect(res.status()).toBe(403)
  })
})
