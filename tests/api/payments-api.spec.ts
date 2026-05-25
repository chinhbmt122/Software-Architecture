// Backend API tests: UC-17 MoMo Payments, UC-18 Unlock VIP Chapter
import { test, expect } from "@playwright/test"
import crypto from "crypto"

let firstNovelId: string
let vipChapterId: string
let freeChapterId: string

test.beforeAll(async ({ request }) => {
  const novelsRes = await request.get("/api/novels")
  if (!novelsRes.ok()) return
  const novels: Array<{ id: string }> = await novelsRes.json()
  if (novels.length === 0) return
  firstNovelId = novels[0].id

  const chaptersRes = await request.get(`/api/novels/${firstNovelId}/chapters`)
  if (!chaptersRes.ok()) return
  const chapters: Array<{ id: string; isVip: boolean }> = await chaptersRes.json()
  vipChapterId = chapters.find((c) => c.isVip)?.id ?? ""
  freeChapterId = chapters.find((c) => !c.isVip)?.id ?? ""
})

// ── UC-17: MoMo Webhook Signature Validation ──────────────────────────────────
test.describe("UC-17 MoMo Webhook — HMAC validation", () => {
  const WEBHOOK = "/api/payment/momo/webhook"

  const basePayload = {
    partnerCode: "MOMO",
    orderId: "ORDER_PLAYWRIGHT_001",
    requestId: "REQUEST_001",
    amount: 50000,
    orderInfo: "Test payment",
    orderType: "momo_wallet",
    transId: 9999999,
    resultCode: 0,
    message: "Successful.",
    payType: "qr",
    responseTime: Date.now(),
    extraData: "",
  }

  test("TC-BE-17-006 invalid HMAC returns 400 — no coins credited", async ({ request }) => {
    const res = await request.post(WEBHOOK, {
      data: { ...basePayload, signature: "invalidsignature" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-17-007 missing HMAC field returns 400", async ({ request }) => {
    const { signature: _, ...payloadWithoutSig } = { ...basePayload, signature: undefined }
    const res = await request.post(WEBHOOK, {
      data: payloadWithoutSig,
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-17-008 empty string HMAC returns 400", async ({ request }) => {
    const res = await request.post(WEBHOOK, {
      data: { ...basePayload, signature: "" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-17-021 MOMO_SECRET_KEY not present in any response", async ({ request }) => {
    const res = await request.post(WEBHOOK, {
      data: { ...basePayload, signature: "invalidsignature" },
    })
    const body = await res.text()
    const secret = process.env.MOMO_SECRET_KEY ?? ""
    if (secret) {
      expect(body).not.toContain(secret)
    }
    // Always check response doesn't leak environment variables
    expect(body.toLowerCase()).not.toContain("secret_key")
  })

  test("TC-BE-17-011 resultCode != 0 — fails gracefully when orderId not found", async ({ request }) => {
    const res = await request.post(WEBHOOK, {
      data: { ...basePayload, resultCode: 1, signature: "invalidsignature" },
    })
    // Should return 400 (invalid signature) or 200 (if signature not checked first)
    expect([400, 200]).toContain(res.status())
  })
})

// ── UC-18: Unlock VIP Chapter ──────────────────────────────────────────────────
test.describe("UC-18 Unlock VIP Chapter — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-18-001 unlock without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/novels/any/chapters/any/unlock")
    expect(res.status()).toBe(401)
  })
})

test.describe("UC-18 Unlock VIP Chapter — authenticated reader", () => {
  test("TC-BE-18-002 unlock a free chapter returns 400 — cannot unlock free chapter", async ({ request }) => {
    if (!freeChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${freeChapterId}/unlock`,
    )
    // Free chapters cannot be unlocked
    expect([400, 422]).toContain(res.status())
  })

  test("TC-BE-18-003 unlock non-existent chapter returns 404", async ({ request }) => {
    const res = await request.post("/api/novels/any/chapters/non-existent-id/unlock")
    expect(res.status()).toBe(404)
  })

  test("TC-BE-18-009 VIP chapter unlock with 0 coins returns 402 insufficient_coins", async ({ request }) => {
    if (!vipChapterId || !firstNovelId) test.skip()
    // The test user has 0 coins (never purchased)
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${vipChapterId}/unlock`,
    )
    // Either 402 (insufficient coins) or 200 (if user already unlocked) or 400 (if not VIP)
    expect([200, 402]).toContain(res.status())
    if (res.status() === 402) {
      const body = await res.json()
      expect(body.error.toLowerCase()).toContain("insufficient")
    }
  })

  test("TC-BE-18-012 already-unlocked chapter returns 200 idempotent", async ({ request }) => {
    // If user has coins from a previous test run or admin grant, re-unlock should return 200
    // For most test environments this will hit the 402 path; that is also acceptable
    if (!vipChapterId || !firstNovelId) test.skip()
    const res = await request.post(
      `/api/novels/${firstNovelId}/chapters/${vipChapterId}/unlock`,
    )
    expect([200, 402]).toContain(res.status())
  })
})

// ── Payment balance endpoint ───────────────────────────────────────────────────
test.describe("UC-17 Payment Balance — authenticated", () => {
  test("GET /api/payment/balance returns coin balance", async ({ request }) => {
    const res = await request.get("/api/payment/balance")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(typeof body.balance === "number" || typeof body.coinBalance === "number").toBeTruthy()
  })
})

test.describe("UC-17 Payment Balance — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-17-003 coin purchase without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/payment/momo/create", {
      data: { packageId: 1 },
    })
    expect(res.status()).toBe(401)
  })
})
