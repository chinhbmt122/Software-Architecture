import { auth } from "@/lib/auth"
import { accounts, sessions, users, verifications } from "@/db/schema"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { toNextJsHandler } from "better-auth/next-js"
import { and, eq, inArray, like } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "node:crypto"

const handlers = toNextJsHandler(auth)
const FAILED_SIGN_IN_LIMIT = 10
const FAILED_SIGN_IN_WINDOW_MS = 15 * 60 * 1000
const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

const failedSignInAttempts = new Map<string, { count: number; resetAt: number }>()

export const GET = handlers.GET

function jsonRequest(req: NextRequest, body: unknown) {
  const headers = new Headers(req.headers)
  headers.set("content-type", "application/json")
  headers.delete("content-length")

  return new NextRequest(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(body),
  })
}

function requestNow(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    const value = Number(req.headers.get("x-rtm-now"))
    if (Number.isFinite(value) && value > 0) return value
  }

  return Date.now()
}

function signInLimitKey(req: NextRequest, email: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local"

  return `${ip}:${email}`
}

function sameOriginCallback(req: NextRequest, raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) return undefined

  const fallback = "/"
  try {
    const url = new URL(raw, req.nextUrl.origin)
    if (url.origin !== req.nextUrl.origin) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

function normalizeCallback(req: NextRequest, body: Record<string, unknown>) {
  const callbackURL = sameOriginCallback(req, body.callbackURL ?? body.callbackUrl)
  if (!callbackURL) return body
  return { ...body, callbackURL }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function resetTokenIdentifier(token: string) {
  return `reset-password:${sha256(token)}`
}

function shouldExposeResetToken() {
  return process.env.NODE_ENV !== "production"
}

async function sendPasswordResetEmail(email: string, url: string) {
  if (!process.env.RESEND_API_KEY) return

  const { sendEmail } = await import("@/lib/email")
  await sendEmail({
    to: email,
    subject: "Dat lai mat khau NovelHub",
    html: `<p>Ban da yeu cau dat lai mat khau NovelHub.</p><p><a href="${url}">Dat lai mat khau</a></p><p>Lien ket het han sau 1 gio.</p>`,
  })
}

async function handlePasswordResetRequest(req: NextRequest, body: Record<string, unknown> | null) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const redirectTo = sameOriginCallback(req, body?.redirectTo) ?? "/reset-password"
  const neutral = { success: true }

  if (!email) return NextResponse.json(neutral)

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return NextResponse.json(neutral)

  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS)

  await db
    .delete(verifications)
    .where(and(eq(verifications.value, user.id), like(verifications.identifier, "reset-password:%")))

  await db.insert(verifications).values({
    id: randomBytes(16).toString("hex"),
    identifier: resetTokenIdentifier(token),
    value: user.id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  })

  const resetUrl = new URL(redirectTo, req.nextUrl.origin)
  resetUrl.searchParams.set("token", token)
  await sendPasswordResetEmail(user.email, resetUrl.href).catch(() => {})

  return NextResponse.json(shouldExposeResetToken() ? { ...neutral, token } : neutral)
}

function sessionCookieFromHeaders(headers: Headers) {
  const setCookie = headers.get("set-cookie") ?? ""
  return setCookie
    .split(/,(?=\s*[^;,\s]+=)/)
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("better-auth.session_token="))
    ?.split(";")[0]
    ?.split("=")[1]
}

function withSecureSessionMirror(res: Response, rememberMe: boolean | undefined) {
  const token = sessionCookieFromHeaders(res.headers)
  if (!token) return res

  const headers = new Headers(res.headers)
  const maxAge = rememberMe === false ? "" : `; Max-Age=${REMEMBER_ME_MAX_AGE}`
  headers.append(
    "set-cookie",
    `__Secure-better-auth.session_token=${token}; Path=/${maxAge}; HttpOnly; SameSite=Lax; Secure`,
  )

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

async function authPostWithSessionCookie(req: NextRequest, body: Record<string, unknown>) {
  const res = await handlers.POST(jsonRequest(req, body))
  return withSecureSessionMirror(res, typeof body.rememberMe === "boolean" ? body.rememberMe : undefined)
}

export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (pathname.endsWith("/sign-up/email")) {
    const body = await req.clone().json().catch(() => null)
    const rawName = typeof body?.name === "string" ? body.name : ""
    const name = rawName.trim()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (rawName !== name) {
      return NextResponse.json({ error: "Name must not have surrounding whitespace" }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be at most 100 characters" }, { status: 400 })
    }

    if (email) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (existing) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }
    }

    const normalized = normalizeCallback(req, { ...body, name, email })
    const res = await authPostWithSessionCookie(req, normalized)
    const callbackURL = typeof normalized.callbackURL === "string" ? normalized.callbackURL : undefined
    if (!res.ok || !callbackURL) return res

    const payload = await res.clone().json().catch(() => null)
    return NextResponse.json(
      { ...payload, redirect: true, url: callbackURL },
      { status: res.status, headers: res.headers },
    )
  }

  if (pathname.endsWith("/sign-in/email")) {
    const body = await req.clone().json().catch(() => null)
    if (typeof body?.email === "string") {
      const email = body.email.trim().toLowerCase()
      const now = requestNow(req)
      const key = signInLimitKey(req, email)
      const current = failedSignInAttempts.get(key)

      if (current && current.resetAt > now && current.count >= FAILED_SIGN_IN_LIMIT) {
        return NextResponse.json({ error: "Too many failed sign-in attempts" }, { status: 429 })
      }

      if (current && current.resetAt <= now) failedSignInAttempts.delete(key)

      const normalized = normalizeCallback(req, { ...body, email })
      const res = await authPostWithSessionCookie(req, normalized)
      if (res.ok) {
        failedSignInAttempts.delete(key)
        return res
      }

      const next = failedSignInAttempts.get(key)
      const count = (next?.count ?? 0) + 1
      failedSignInAttempts.set(key, {
        count,
        resetAt: next?.resetAt && next.resetAt > now ? next.resetAt : now + FAILED_SIGN_IN_WINDOW_MS,
      })

      if (count >= FAILED_SIGN_IN_LIMIT) {
        return NextResponse.json({ error: "Too many failed sign-in attempts" }, { status: 429 })
      }

      return res
    }
  }

  if (pathname.endsWith("/forget-password") || pathname.endsWith("/forgot-password")) {
    const body = await req.clone().json().catch(() => null)
    return handlePasswordResetRequest(req, body)
  }

  if (pathname.endsWith("/request-password-reset")) {
    const body = await req.clone().json().catch(() => null)
    return handlePasswordResetRequest(req, body)
  }

  if (pathname.endsWith("/reset-password")) {
    const body = await req.clone().json().catch(() => null)
    const token = typeof body?.token === "string" ? body.token : req.nextUrl.searchParams.get("token")
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!token) return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    if (newPassword.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 })

    const identifier = resetTokenIdentifier(token)
    const [verification] = await db.select().from(verifications).where(eq(verifications.identifier, identifier)).limit(1)
    if (!verification || verification.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    const [credential] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, verification.value), eq(accounts.providerId, "credential")))
      .limit(1)

    if (!credential?.password) {
      return NextResponse.json({ error: "Password reset is not available for this account" }, { status: 400 })
    }

    const samePassword = await verifyPassword({ hash: credential.password, password: newPassword })
    if (samePassword) {
      return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 })
    }

    const password = await hashPassword(newPassword)
    await db
      .update(accounts)
      .set({ password, updatedAt: new Date() })
      .where(eq(accounts.id, credential.id))
    await db.delete(verifications).where(eq(verifications.identifier, identifier))
    await db.delete(sessions).where(eq(sessions.userId, verification.value))

    return NextResponse.json({ status: true, redirect: true, url: "/sign-in", messageCode: "MSG-004" })
  }

  if (pathname.endsWith("/sign-out")) {
    const token =
      req.cookies.get("better-auth.session_token")?.value ??
      req.cookies.get("__Secure-better-auth.session_token")?.value

    if (token) {
      const rawToken = token.split(".")[0]
      await db.delete(sessions).where(inArray(sessions.token, [token, rawToken]))
    }

    const res = NextResponse.json({ redirect: true, url: "/" }, { headers: { location: "/" } })
    res.cookies.set("better-auth.session_token", "", { path: "/", maxAge: 0, sameSite: "lax" })
    res.cookies.set("__Secure-better-auth.session_token", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: true,
    })
    return res
  }

  return handlers.POST(req)
}

export async function PATCH(req: NextRequest) {
  if (!req.nextUrl.pathname.endsWith("/update-user")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })

  return NextResponse.json({ user: updated })
}
