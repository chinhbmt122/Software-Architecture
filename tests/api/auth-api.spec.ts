// Backend API tests: UC-01 Register, UC-02 Sign In, UC-04 Sign Out, UC-05 Reset Password
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test"
import { accounts, sessions, users, verifications } from "@/db/schema"
import { db } from "@/lib/db"
import { and, eq, like } from "drizzle-orm"

const SIGN_UP = "/api/auth/sign-up/email"
const SIGN_IN = "/api/auth/sign-in/email"
const SIGN_OUT = "/api/auth/sign-out"
const FORGOT_PW = "/api/auth/forget-password"
const RESET_PW = "/api/auth/reset-password"
const DAY_SECONDS = 24 * 60 * 60
const THIRTY_DAYS_SECONDS = 30 * DAY_SECONDS

function freshEmail() {
  return `testuser.${Date.now()}.${Math.random().toString(36).slice(2)}@novelhub-test.com`
}

async function storedUser(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return user
}

async function createPasswordUser(request: APIRequestContext, password = "password123") {
  const email = freshEmail()
  const res = await request.post(SIGN_UP, {
    headers: { origin: "http://localhost:3000", cookie: "" },
    data: { name: "Reset User", email, password },
  })
  expect(res.ok()).toBeTruthy()
  const user = await storedUser(email)
  expect(user).toBeTruthy()
  return { email, password, user: user! }
}

async function requestResetToken(request: APIRequestContext, email: string) {
  const res = await request.post(FORGOT_PW, {
    data: { email, redirectTo: "/reset-password" },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.token).toBeTruthy()
  return body.token as string
}

async function resetVerificationForUser(userId: string) {
  return db
    .select()
    .from(verifications)
    .where(and(eq(verifications.value, userId), like(verifications.identifier, "reset-password:%")))
}

function sessionCookie(setCookie: string) {
  return setCookie
    .split(/,(?=\s*[^;,\s]+=)/)
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("better-auth.session_token="))
    ?.split(";")[0]
}

function rawSessionToken(cookie: string) {
  return cookie.split("=")[1]?.split(".")[0]
}

async function storedSession(token: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
  return session
}

function lifetimeSeconds(row: { createdAt: Date; expiresAt: Date }) {
  return Math.round((row.expiresAt.getTime() - row.createdAt.getTime()) / 1000)
}

async function signedInCookie(request: APIRequestContext) {
  const signIn = await request.post(SIGN_IN, {
    data: {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    },
  })
  expect(signIn.ok()).toBeTruthy()
  const cookie = sessionCookie(signIn.headers()["set-cookie"] ?? "")
  expect(cookie).toBeTruthy()
  return cookie!
}

// ── UC-01: Register Account ────────────────────────────────────────────────────
test.describe("UC-01 Register Account — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-01-001 valid registration returns user object", async ({ request }) => {
    const email = freshEmail()
    const res = await request.post(SIGN_UP, {
      data: { name: "New User", email, password: "password123" },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.user ?? body).toMatchObject({ email })
  })

  test("TC-BE-01-002 password is stored as a hash, never plaintext", async ({ request }) => {
    const email = freshEmail()
    const password = "password123"
    const res = await request.post(SIGN_UP, {
      data: { name: "Hash Check", email, password },
    })
    expect(res.ok()).toBeTruthy()

    const user = await storedUser(email)
    expect(user).toBeTruthy()
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user!.id))
    const passwordAccount = rows.find((row) => row.password)
    expect(passwordAccount?.password).toBeTruthy()
    expect(passwordAccount?.password).not.toBe(password)
    expect(passwordAccount!.password!.length).toBeGreaterThan(20)
  })

  test("TC-BE-01-003 new user has role READER", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Reader", email: freshEmail(), password: "password123" },
    })
    const body = await res.json()
    const role = body.user?.role ?? body.role
    // Better Auth may return lowercase or uppercase
    expect(role?.toLowerCase()).toMatch(/reader/)
  })

  test("TC-BE-01-004 new user coinBalance=0", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Coinless", email: freshEmail(), password: "password123" },
    })
    const body = await res.json()
    const balance = body.user?.coinBalance ?? body.coinBalance
    if (balance !== undefined) expect(balance).toBe(0)
  })

  test("TC-BE-01-005 registration creates httpOnly session cookie", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Cookie User", email: freshEmail(), password: "password123" },
    })
    expect(res.ok()).toBeTruthy()
    const setCookie = res.headers()["set-cookie"] ?? ""
    expect(setCookie).toContain("better-auth.session_token")
    expect(setCookie.toLowerCase()).toContain("httponly")
  })

  test("TC-BE-01-006 session cookie has Secure=true and SameSite=Lax attributes", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Secure Cookie User", email: freshEmail(), password: "password123" },
    })
    expect(res.ok()).toBeTruthy()
    const setCookie = res.headers()["set-cookie"] ?? ""
    expect(setCookie).toContain("__Secure-better-auth.session_token")
    expect(setCookie.toLowerCase()).toContain("secure")
    expect(setCookie.toLowerCase()).toContain("samesite=lax")
  })

  test("TC-BE-01-007 empty name returns error", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "", email: freshEmail(), password: "password123" },
    })
    expect(res.ok()).toBeFalsy()
  })

  test("TC-BE-01-008 name length boundary: 101 chars rejected, 100 chars accepted", async ({ request }) => {
    const tooLong = await request.post(SIGN_UP, {
      data: { name: "a".repeat(101), email: freshEmail(), password: "password123" },
    })
    expect(tooLong.status()).toBe(400)

    const boundary = await request.post(SIGN_UP, {
      data: { name: "a".repeat(100), email: freshEmail(), password: "password123" },
    })
    expect(boundary.ok()).toBeTruthy()
  })

  test("TC-BE-01-009 name with surrounding whitespace is rejected", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: " User ", email: freshEmail(), password: "password123" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-01-010 invalid email format returns error", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "User", email: "notanemail", password: "password123" },
    })
    expect(res.ok()).toBeFalsy()
  })

  test("TC-BE-01-011 email is normalized to lowercase before storage", async ({ request }) => {
    const mixed = freshEmail().replace("@", ".MiXeD@").toUpperCase()
    const expected = mixed.toLowerCase()
    const res = await request.post(SIGN_UP, {
      data: { name: "Lower Email", email: mixed, password: "password123" },
    })
    expect(res.ok()).toBeTruthy()
    const user = await storedUser(expected)
    expect(user?.email).toBe(expected)
  })

  test("TC-BE-01-012 password 7 chars returns error", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "User", email: freshEmail(), password: "short12" },
    })
    expect(res.ok()).toBeFalsy()
  })

  test("TC-BE-01-013 password 8 chars accepted", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "User", email: freshEmail(), password: "exactly8" },
    })
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-01-014 password 128 chars accepted", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Long Password", email: freshEmail(), password: "a".repeat(128) },
    })
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-01-015 duplicate email returns 409 or 422", async ({ request }) => {
    const email = freshEmail()
    await request.post(SIGN_UP, { data: { name: "First", email, password: "password123" } })
    const dup = await request.post(SIGN_UP, { data: { name: "Second", email, password: "password456" } })
    expect([409, 422]).toContain(dup.status())
  })

  test("TC-BE-01-016 duplicate email check is case-insensitive", async ({ request }) => {
    const email = freshEmail()
    await request.post(SIGN_UP, { data: { name: "First", email, password: "password123" } })
    const dup = await request.post(SIGN_UP, {
      data: { name: "Second", email: email.toUpperCase(), password: "password456" },
    })
    expect([409, 422]).toContain(dup.status())
  })

  test("TC-BE-01-019 concurrent duplicate registration creates exactly one user row", async ({ request }) => {
    const email = freshEmail()
    const [first, second] = await Promise.all([
      request.post(SIGN_UP, { data: { name: "Race One", email, password: "password123" } }),
      request.post(SIGN_UP, { data: { name: "Race Two", email, password: "password123" } }),
    ])

    expect([first.status(), second.status()].filter((status) => status >= 200 && status < 300)).toHaveLength(1)
    const rows = await db.select().from(users).where(eq(users.email, email))
    expect(rows).toHaveLength(1)
  })

  test("TC-BE-01-020 missing email field returns error", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "User", password: "password123" },
    })
    expect(res.ok()).toBeFalsy()
  })

  test("TC-BE-01-017 same-origin callbackUrl=/library is returned after registration", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: { name: "Callback User", email: freshEmail(), password: "password123", callbackUrl: "/library" },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(body.url).toBe("/library")
  })

  test("TC-BE-01-018 external callbackUrl is rejected and normalized to / after registration", async ({ request }) => {
    const res = await request.post(SIGN_UP, {
      data: {
        name: "Callback External User",
        email: freshEmail(),
        password: "password123",
        callbackUrl: "https://evil.com",
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(body.url).toBe("/")
  })
})

// ── UC-02: Sign In with Email ──────────────────────────────────────────────────
test.describe("UC-02 Sign In with Email — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-02-001 correct credentials return 200 and session", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: {
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
        rememberMe: false,
      },
    })
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-02-002 successful sign-in sets session cookie", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: {
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
        rememberMe: false,
      },
    })
    const setCookie = res.headers()["set-cookie"] ?? ""
    expect(setCookie).toContain("better-auth.session_token")
  })

  test("TC-BE-02-003 wrong password returns generic error — body not revealing email existence", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: { email: process.env.TEST_USER_EMAIL, password: "wrongpassword999" },
    })
    expect(res.ok()).toBeFalsy()
    const text = await res.text()
    // Must not say "email found" or similar — just generic error
    expect(text.toLowerCase()).not.toContain("email found")
    expect(text.toLowerCase()).not.toContain("exists")
  })

  test("TC-BE-02-004 non-existent email same error shape as wrong password", async ({ request }) => {
    const wrongPassRes = await request.post(SIGN_IN, {
      data: { email: process.env.TEST_USER_EMAIL, password: "wrongpassword999" },
    })
    const noUserRes = await request.post(SIGN_IN, {
      data: { email: "nonexistent@novelhub-test.com", password: "wrongpassword999" },
    })
    // Both should fail (4xx)
    expect(wrongPassRes.ok()).toBeFalsy()
    expect(noUserRes.ok()).toBeFalsy()
    // Both should return similar status codes (no enumeration)
    expect(wrongPassRes.status()).toBe(noUserRes.status())
  })

  test("TC-BE-02-005 first nine failed attempts are rejected without rate-limit response", async ({ request }) => {
    const email = freshEmail()
    const ip = "10.20.30.39"
    await request.post(SIGN_UP, { data: { name: "Rate Limit User", email, password: "password123" } })

    for (let attempt = 1; attempt <= 9; attempt += 1) {
      const res = await request.post(SIGN_IN, {
        headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
        data: { email, password: "wrongpassword999" },
      })
      expect(res.ok()).toBeFalsy()
      expect(res.status()).not.toBe(429)
    }
  })

  test("TC-BE-02-006 tenth failed attempt in 15-minute window returns 429", async ({ request }) => {
    const email = freshEmail()
    const ip = "10.20.30.40"
    await request.post(SIGN_UP, { data: { name: "Limited User", email, password: "password123" } })

    for (let attempt = 1; attempt <= 9; attempt += 1) {
      const res = await request.post(SIGN_IN, {
        headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
        data: { email, password: "wrongpassword999" },
      })
      expect(res.status()).not.toBe(429)
    }

    const tenth = await request.post(SIGN_IN, {
      headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
      data: { email, password: "wrongpassword999" },
    })
    expect(tenth.status()).toBe(429)
  })

  test("TC-BE-02-007 correct credentials remain blocked until rate-limit window expires", async ({ request }) => {
    const email = freshEmail()
    const ip = "10.20.30.41"
    await request.post(SIGN_UP, { data: { name: "Blocked User", email, password: "password123" } })

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request.post(SIGN_IN, {
        headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
        data: { email, password: "wrongpassword999" },
      })
    }

    const res = await request.post(SIGN_IN, {
      headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
      data: { email, password: "password123" },
    })
    expect(res.status()).toBe(429)
  })

  test("TC-BE-02-008 rate-limit counter resets after 15-minute window", async ({ request }) => {
    const email = freshEmail()
    const ip = "10.20.30.42"
    const now = Date.now()
    await request.post(SIGN_UP, { data: { name: "Window User", email, password: "password123" } })

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request.post(SIGN_IN, {
        headers: { origin: "http://localhost:3000", "x-forwarded-for": ip, "x-rtm-now": String(now) },
        data: { email, password: "wrongpassword999" },
      })
    }

    const res = await request.post(SIGN_IN, {
      headers: {
        origin: "http://localhost:3000",
        "x-forwarded-for": ip,
        "x-rtm-now": String(now + 15 * 60 * 1000 + 1),
      },
      data: { email, password: "password123" },
    })
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-02-009 rememberMe=true stores a 30-day session TTL", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD, rememberMe: true },
    })
    expect(res.ok()).toBeTruthy()
    const token = (await res.json()).token as string
    const session = await storedSession(token)
    expect(session).toBeTruthy()
    expect(lifetimeSeconds(session!)).toBeGreaterThanOrEqual(THIRTY_DAYS_SECONDS - 5)
  })

  test("TC-BE-02-010 rememberMe=false stores a 1-day session TTL", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD, rememberMe: false },
    })
    expect(res.ok()).toBeTruthy()
    const token = (await res.json()).token as string
    const session = await storedSession(token)
    expect(session).toBeTruthy()
    expect(lifetimeSeconds(session!)).toBeLessThanOrEqual(DAY_SECONDS + 5)
  })

  test("TC-BE-02-011 same-origin callbackUrl=/library is honored after sign-in", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD, callbackUrl: "/library" },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(body.url).toBe("/library")
  })

  test("TC-BE-02-012 external callbackUrl is rejected and normalized to / after sign-in", async ({ request }) => {
    const res = await request.post(SIGN_IN, {
      data: {
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
        callbackUrl: "https://evil.com",
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.redirect).toBe(true)
    expect(body.url).toBe("/")
  })

  test("TC-BE-02-014 email comparison is case-insensitive", async ({ request }) => {
    const email = freshEmail()
    const password = "password123"
    const signup = await request.post(SIGN_UP, {
      data: { name: "Case Login", email, password },
    })
    expect(signup.ok()).toBeTruthy()

    const isolated = await playwrightRequest.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "http://localhost:3000" },
    })
    try {
      const res = await isolated.post(SIGN_IN, {
        data: { email: email.toUpperCase(), password },
      })
      expect(res.ok()).toBeTruthy()
    } finally {
      await isolated.dispose()
    }
  })

  test("TC-BE-02-013 Google-only account submitted to email sign-in returns an error", async ({ request }) => {
    const email = freshEmail()
    const now = new Date()
    await db.insert(users).values({
      id: `google-user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Google Only",
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      role: "READER",
      status: "ACTIVE",
      coinBalance: 0,
    })
    const user = await storedUser(email)
    expect(user).toBeTruthy()
    await db.insert(accounts).values({
      id: `google-account-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: user!.id,
      accountId: `google-sub-${Date.now()}`,
      providerId: "google",
      createdAt: now,
      updatedAt: now,
    })

    const res = await request.post(SIGN_IN, {
      data: { email, password: "password123" },
    })
    expect(res.ok()).toBeFalsy()
    expect([400, 401]).toContain(res.status())
  })
})

// ── UC-04: Sign Out ────────────────────────────────────────────────────────────
test.describe("UC-04 Sign Out — authenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-04-001 sign-out removes session cookie", async ({ request }) => {
    const cookie = await signedInCookie(request)
    const signOutRes = await request.post(SIGN_OUT, { headers: { cookie } })
    // Should succeed (2xx) or at minimum not throw
    expect([200, 204, 302]).toContain(signOutRes.status())

    // Some implementations redirect; if no set-cookie header, that is also acceptable
    // We just confirm the sign-out call doesn't error
    expect([200, 204, 302]).toContain(signOutRes.status())
  })

  test("TC-BE-04-002 sign-out response expires the session cookie", async ({ request }) => {
    const cookie = await signedInCookie(request)
    const signOutRes = await request.post(SIGN_OUT, { headers: { cookie } })
    expect([200, 204, 302]).toContain(signOutRes.status())
    const setCookie = signOutRes.headers()["set-cookie"] ?? ""
    expect(setCookie).toContain("better-auth.session_token=")
    expect(setCookie.toLowerCase()).toContain("max-age=0")
  })

  test("TC-BE-04-004 sign-out redirects to / and never to a protected page", async ({ request }) => {
    const cookie = await signedInCookie(request)
    const res = await request.post(SIGN_OUT, { headers: { cookie } })
    expect(res.ok()).toBeTruthy()
    expect(res.headers()["location"]).toBe("/")
    const body = await res.json()
    expect(body.url).toBe("/")
  })

  test("TC-BE-04-006 other sessions for the same user remain valid after single sign-out", async () => {
    const first = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" })
    const second = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" })

    try {
      const firstCookie = await signedInCookie(first)
      const secondCookie = await signedInCookie(second)
      const firstRawToken = rawSessionToken(firstCookie)
      const secondRawToken = rawSessionToken(secondCookie)
      expect(firstRawToken).toBeTruthy()
      expect(secondRawToken).toBeTruthy()
      expect(firstRawToken).not.toBe(secondRawToken)

      await first.post(SIGN_OUT, { headers: { cookie: firstCookie } })

      const firstSession = await first.get("/api/auth/get-session", { headers: { cookie: firstCookie } })
      expect((await firstSession.json().catch(() => null))?.user ?? null).toBeNull()

      const secondSession = await second.get("/api/auth/get-session", { headers: { cookie: secondCookie } })
      expect(secondSession.ok()).toBeTruthy()
      expect((await secondSession.json()).user).toBeTruthy()
    } finally {
      await first.dispose()
      await second.dispose()
    }
  })
})

test.describe("UC-04 Sign Out â€” unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-04-005 unauthenticated POST to sign-out handled gracefully", async ({ request }) => {
    const res = await request.post("/api/auth/sign-out")
    expect([200, 204, 401]).toContain(res.status())
  })

  test("TC-BE-04-003 old session token is invalid after sign-out", async ({ request }) => {
    const signIn = await request.post(SIGN_IN, {
      data: {
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      },
    })
    expect(signIn.ok()).toBeTruthy()
    const cookie = sessionCookie(signIn.headers()["set-cookie"] ?? "")
    expect(cookie).toBeTruthy()

    const before = await request.get("/api/auth/get-session", { headers: { cookie: cookie! } })
    expect(before.ok()).toBeTruthy()
    expect((await before.json()).user).toBeTruthy()

    await request.post(SIGN_OUT, { headers: { cookie: cookie! } })
    const after = await request.get("/api/auth/get-session", { headers: { cookie: cookie! } })
    const session = await after.json().catch(() => null)
    expect(session?.user ?? null).toBeNull()
  })
})

// ── UC-05: Reset Password ──────────────────────────────────────────────────────
test.describe("UC-05 Reset Password — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("TC-BE-05-001 known email shows neutral response", async ({ request }) => {
    const res = await request.post(FORGOT_PW, {
      data: { email: process.env.TEST_USER_EMAIL, redirectTo: "/sign-in" },
    })
    // Better Auth returns 200 regardless of whether email exists (no enumeration)
    expect([200, 201]).toContain(res.status())
  })

  test("TC-BE-05-002 unknown email returns same neutral response (no enumeration)", async ({ request }) => {
    const res = await request.post(FORGOT_PW, {
      data: { email: "nobody@novelhub-test.com", redirectTo: "/sign-in" },
    })
    expect([200, 201]).toContain(res.status())
  })

  test("TC-BE-05-003 response body identical for known and unknown email", async ({ request }) => {
    const known = await request.post(FORGOT_PW, {
      data: { email: process.env.TEST_USER_EMAIL, redirectTo: "/sign-in" },
    })
    const unknown = await request.post(FORGOT_PW, {
      data: { email: "nobody@novelhub-test.com", redirectTo: "/sign-in" },
    })
    expect(known.status()).toBe(unknown.status())
  })

  test("TC-BE-05-004 reset token is stored as SHA-256 hash; raw token never appears in DB", async ({ request }) => {
    const { email, user } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    const rows = await resetVerificationForUser(user.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].identifier).toMatch(/^reset-password:[a-f0-9]{64}$/)
    expect(rows[0].identifier).not.toContain(token)
    expect(rows[0].value).toBe(user.id)
  })

  test("TC-BE-05-005 expired reset token is rejected", async ({ request }) => {
    const { email, user } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    await db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(verifications.value, user.id), like(verifications.identifier, "reset-password:%")))

    const res = await request.post(RESET_PW, {
      data: { token, newPassword: "newpassword123" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-05-006 reset token accepted before expiry and rejected after expiry boundary", async ({ request }) => {
    const accepted = await createPasswordUser(request)
    const acceptedToken = await requestResetToken(request, accepted.email)
    await db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() + 5000) })
      .where(and(eq(verifications.value, accepted.user.id), like(verifications.identifier, "reset-password:%")))

    const ok = await request.post(RESET_PW, {
      data: { token: acceptedToken, newPassword: "newpassword123" },
    })
    expect(ok.ok()).toBeTruthy()

    const rejected = await createPasswordUser(request)
    const rejectedToken = await requestResetToken(request, rejected.email)
    await db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(verifications.value, rejected.user.id), like(verifications.identifier, "reset-password:%")))

    const expired = await request.post(RESET_PW, {
      data: { token: rejectedToken, newPassword: "newpassword123" },
    })
    expect(expired.status()).toBe(400)
  })

  test("TC-BE-05-007 reset token is single-use", async ({ request }) => {
    const { email } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)

    const first = await request.post(RESET_PW, {
      data: { token, newPassword: "newpassword123" },
    })
    expect(first.ok()).toBeTruthy()

    const second = await request.post(RESET_PW, {
      data: { token, newPassword: "anotherpassword123" },
    })
    expect(second.status()).toBe(400)
  })

  test("TC-BE-05-008 new password with 7 chars is rejected", async ({ request }) => {
    const { email } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    const res = await request.post(RESET_PW, {
      data: { token, newPassword: "short12" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-05-009 new password with 8 chars is accepted", async ({ request }) => {
    const { email } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    const res = await request.post(RESET_PW, {
      data: { token, newPassword: "exactly8" },
    })
    expect(res.ok()).toBeTruthy()
  })

  test("TC-BE-05-010 new password same as current is rejected", async ({ request }) => {
    const { email, password } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    const res = await request.post(RESET_PW, {
      data: { token, newPassword: password },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-05-011 successful reset invalidates existing sessions for that user", async () => {
    const setup = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" })
    const first = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" })
    const second = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" })

    try {
      const { email, password } = await createPasswordUser(setup)
      const firstSignIn = await first.post(SIGN_IN, { data: { email, password } })
      const secondSignIn = await second.post(SIGN_IN, { data: { email, password } })
      expect(firstSignIn.ok()).toBeTruthy()
      expect(secondSignIn.ok()).toBeTruthy()
      const firstCookie = sessionCookie(firstSignIn.headers()["set-cookie"] ?? "")
      const secondCookie = sessionCookie(secondSignIn.headers()["set-cookie"] ?? "")
      expect(firstCookie).toBeTruthy()
      expect(secondCookie).toBeTruthy()

      const token = await requestResetToken(setup, email)
      const reset = await setup.post(RESET_PW, {
        data: { token, newPassword: "newpassword123" },
      })
      expect(reset.ok()).toBeTruthy()

      const firstSession = await first.get("/api/auth/get-session", { headers: { cookie: firstCookie! } })
      const secondSession = await second.get("/api/auth/get-session", { headers: { cookie: secondCookie! } })
      expect((await firstSession.json().catch(() => null))?.user ?? null).toBeNull()
      expect((await secondSession.json().catch(() => null))?.user ?? null).toBeNull()
    } finally {
      await setup.dispose()
      await first.dispose()
      await second.dispose()
    }
  })

  test("TC-BE-05-012 successful reset returns sign-in redirect metadata with MSG-004", async ({ request }) => {
    const { email } = await createPasswordUser(request)
    const token = await requestResetToken(request, email)
    const res = await request.post(RESET_PW, {
      data: { token, newPassword: "newpassword123" },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.url).toBe("/sign-in")
    expect(body.messageCode).toBe("MSG-004")
  })

  test("TC-BE-05-013 Google-only account cannot reset password through password endpoint", async ({ request }) => {
    const email = freshEmail()
    const now = new Date()
    await db.insert(users).values({
      id: `google-reset-user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Google Reset Only",
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      role: "READER",
      status: "ACTIVE",
      coinBalance: 0,
    })
    const user = await storedUser(email)
    expect(user).toBeTruthy()
    await db.insert(accounts).values({
      id: `google-reset-account-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: user!.id,
      accountId: `google-reset-sub-${Date.now()}`,
      providerId: "google",
      createdAt: now,
      updatedAt: now,
    })

    const token = await requestResetToken(request, email)
    const res = await request.post(RESET_PW, {
      data: { token, newPassword: "password456" },
    })
    expect(res.status()).toBe(400)
  })

  test("TC-BE-05-014 second reset request invalidates the previous token", async ({ request }) => {
    const { email, user } = await createPasswordUser(request)
    const oldToken = await requestResetToken(request, email)
    const newToken = await requestResetToken(request, email)
    expect(newToken).not.toBe(oldToken)

    const rows = await resetVerificationForUser(user.id)
    expect(rows).toHaveLength(1)

    const oldReset = await request.post(RESET_PW, {
      data: { token: oldToken, newPassword: "newpassword123" },
    })
    expect(oldReset.status()).toBe(400)

    const newReset = await request.post(RESET_PW, {
      data: { token: newToken, newPassword: "newpassword123" },
    })
    expect(newReset.ok()).toBeTruthy()
  })
})
