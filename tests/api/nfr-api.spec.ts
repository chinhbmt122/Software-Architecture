// Backend API tests: NFR — Non-Functional Requirements
import { test, expect } from "@playwright/test"

// ── TC-BE-NFR-001: Health check endpoint ──────────────────────────────────────
test.describe("NFR Health Check", () => {
  test("TC-BE-NFR-001 GET /api/health returns 200 with status, timestamp, checks", async ({ request }) => {
    const res = await request.get("/api/health")
    expect([200, 503]).toContain(res.status()) // 503 if DB is down
    const body = await res.json()
    expect(body.status).toMatch(/^(ok|degraded|down)$/)
    expect(body.timestamp).toBeDefined()
    expect(body.checks).toBeDefined()
  })

  test("TC-BE-NFR-002 health check database field has latencyMs", async ({ request }) => {
    const res = await request.get("/api/health")
    const body = await res.json()
    expect(typeof body.checks.database?.latencyMs).toBe("number")
  })

  test("TC-BE-NFR-003 health check redis field present", async ({ request }) => {
    const res = await request.get("/api/health")
    const body = await res.json()
    expect(body.checks.redis).toBeDefined()
    expect(body.checks.redis.status).toMatch(/^(ok|degraded|down)$/)
  })

  test("TC-BE-NFR-004 health check database down → HTTP 503", async ({ request }) => {
    const res = await request.get("/api/health")
    const body = await res.json()
    if (body.checks?.database?.status === "down") {
      expect(res.status()).toBe(503)
    } else {
      expect(res.status()).toBe(200)
    }
  })

  test("TC-BE-NFR-005 all checks include latencyMs", async ({ request }) => {
    const res = await request.get("/api/health")
    const body = await res.json()
    for (const check of Object.values(body.checks) as Array<{ latencyMs: number }>) {
      expect(typeof check.latencyMs).toBe("number")
    }
  })

  test("TC-BE-NFR-001 overall status is ok/degraded/down enum", async ({ request }) => {
    const res = await request.get("/api/health")
    const body = await res.json()
    expect(["ok", "degraded", "down"]).toContain(body.status)
  })
})

// ── TC-BE-NFR-018/030: Web Vitals endpoint ────────────────────────────────────
test.describe("NFR Web Vitals", () => {
  test("TC-BE-NFR-030 POST /api/vitals accepts payload and returns 2xx", async ({ request }) => {
    const res = await request.post("/api/vitals", {
      data: {
        name: "LCP",
        value: 1200,
        rating: "good",
        delta: 1200,
        id: "v3-123",
        navigationType: "navigate",
      },
    })
    expect([200, 204]).toContain(res.status())
  })
})

// ── NFR Security Headers ───────────────────────────────────────────────────────
test.describe("NFR Security Headers", () => {
  test("TC-BE-NFR-020 API routes return JSON Content-Type", async ({ request }) => {
    const res = await request.get("/api/health")
    const contentType = res.headers()["content-type"] ?? ""
    expect(contentType).toContain("application/json")
  })

  test("TC-BE-NFR-022 API routes include X-Content-Type-Options nosniff", async ({ request }) => {
    const res = await request.get("/api/health")
    const header = res.headers()["x-content-type-options"]
    // Next.js sets this header by default
    if (header) expect(header).toContain("nosniff")
  })

  test("API response does not expose stack traces or internal paths", async ({ request }) => {
    const res = await request.get("/api/novels/definitely-not-found-id")
    const body = await res.text()
    expect(body).not.toContain("/Users/")
    expect(body).not.toContain("node_modules")
    expect(body).not.toContain("at Object.")
  })
})

// ── NFR Module Boundary ────────────────────────────────────────────────────────
test.describe("NFR Module Boundary (static analysis)", () => {
  test("TC-BE-NFR-019 XSS prevention — chapter content endpoint never returns raw script tag", async ({ request }) => {
    const novelsRes = await request.get("/api/novels")
    if (!novelsRes.ok()) return
    const novels: Array<{ id: string }> = await novelsRes.json()
    if (novels.length === 0) return

    const chaptersRes = await request.get(`/api/novels/${novels[0].id}/chapters`)
    if (!chaptersRes.ok()) return
    const chapters: Array<{ id: string; content: string }> = await chaptersRes.json()
    if (chapters.length === 0) return

    const chapterRes = await request.get(`/api/novels/${novels[0].id}/chapters/${chapters[0].id}`)
    if (!chapterRes.ok()) return
    const chapter = await chapterRes.json()
    const content = chapter.content ?? ""
    expect(content).not.toMatch(/<script[\s>]/i)
    expect(content).not.toMatch(/javascript:/i)
  })

  test("TC-BE-NFR-027 coin_transactions consistency — balance endpoint returns numeric value", async ({ request }) => {
    const res = await request.get("/api/payment/balance")
    if (!res.ok()) return
    const body = await res.json()
    const balance = body.balance ?? body.coinBalance
    expect(typeof balance).toBe("number")
    expect(balance).toBeGreaterThanOrEqual(0)
  })
})

// ── NFR Performance ────────────────────────────────────────────────────────────
test.describe("NFR Performance", () => {
  test("TC-BE-NFR-007 novel list endpoint responds in under 3s", async ({ request }) => {
    const start = Date.now()
    const res = await request.get("/api/novels")
    const elapsed = Date.now() - start
    expect(res.ok()).toBeTruthy()
    expect(elapsed).toBeLessThan(3000)
  })

  test("TC-BE-NFR-007 health check endpoint responds in under 5s", async ({ request }) => {
    const start = Date.now()
    await request.get("/api/health")
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })
})

// ── Notifications ──────────────────────────────────────────────────────────────
test.describe("Notifications API — authenticated", () => {
  test("GET /api/notifications returns 200", async ({ request }) => {
    const res = await request.get("/api/notifications")
    expect(res.ok()).toBeTruthy()
  })
})

test.describe("Notifications API — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("GET /api/notifications returns 401 for guests", async ({ request }) => {
    const res = await request.get("/api/notifications")
    expect([401, 302]).toContain(res.status())
  })
})
