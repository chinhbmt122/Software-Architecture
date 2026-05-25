import { test as setup, expect, type APIRequestContext } from "@playwright/test"
import path from "path"
import fs from "fs"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "better-auth/crypto"
import { randomUUID } from "node:crypto"
import { AUTH_FILE, CURATOR_AUTH_FILE, ADMIN_AUTH_FILE } from "./constants"

async function promoteRole(email: string, role: "CURATOR" | "ADMIN") {
  const sql = neon(process.env.DATABASE_URL!)
  await sql`UPDATE users SET role = ${role} WHERE email = ${email}`
}

async function repairCredentialPassword(email: string, password: string) {
  const sql = neon(process.env.DATABASE_URL!)
  const users = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  const userId = users[0]?.id as string | undefined
  if (!userId) return

  const hash = await hashPassword(password)
  await sql`UPDATE users SET status = 'ACTIVE' WHERE id = ${userId}`

  const accounts = await sql`
    SELECT id FROM accounts
    WHERE user_id = ${userId} AND provider_id = 'credential'
    LIMIT 1
  `

  if (accounts[0]?.id) {
    await sql`
      UPDATE accounts
      SET password = ${hash}, updated_at = NOW()
      WHERE id = ${accounts[0].id}
    `
  } else {
    await sql`
      INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${hash}, NOW(), NOW())
    `
  }
}

// Returns a signed-in request context. Signs in directly if user exists,
// registers then signs in if user is new. Only ever calls sign-in once.
async function signInOrRegister(
  request: APIRequestContext,
  email: string,
  password: string,
  name: string,
) {
  let res = await request.post("/api/auth/sign-in/email", {
    data: { email, password, rememberMe: true },
  })

  if (!res.ok()) {
    await request.post("/api/auth/sign-up/email", { data: { email, password, name } })
    res = await request.post("/api/auth/sign-in/email", {
      data: { email, password, rememberMe: true },
    })
  }

  if (!res.ok()) {
    await repairCredentialPassword(email, password)
    res = await request.post("/api/auth/sign-in/email", {
      data: { email, password, rememberMe: true },
    })
  }

  return res
}

setup("authenticate as reader", async ({ request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const res = await signInOrRegister(
    request,
    process.env.TEST_USER_EMAIL!,
    process.env.TEST_USER_PASSWORD!,
    "Test User",
  )
  expect(res.ok(), `Reader sign-in failed (${res.status()})`).toBeTruthy()
  await request.storageState({ path: AUTH_FILE })
})

setup("authenticate as curator", async ({ request }) => {
  fs.mkdirSync(path.dirname(CURATOR_AUTH_FILE), { recursive: true })

  const email = process.env.TEST_CURATOR_EMAIL!
  const password = process.env.TEST_CURATOR_PASSWORD!

  const res = await signInOrRegister(request, email, password, "Test Curator")
  expect(res.ok(), `Curator sign-in failed (${res.status()})`).toBeTruthy()

  // Promote after sign-in — Better Auth reads role fresh from DB on every request,
  // so the existing session will reflect the updated role immediately.
  await promoteRole(email, "CURATOR")
  await request.storageState({ path: CURATOR_AUTH_FILE })
})

setup("authenticate as admin", async ({ request }) => {
  fs.mkdirSync(path.dirname(ADMIN_AUTH_FILE), { recursive: true })

  const email = process.env.TEST_ADMIN_EMAIL!
  const password = process.env.TEST_ADMIN_PASSWORD!

  const res = await signInOrRegister(request, email, password, "Test Admin")
  expect(res.ok(), `Admin sign-in failed (${res.status()})`).toBeTruthy()

  await promoteRole(email, "ADMIN")
  await request.storageState({ path: ADMIN_AUTH_FILE })
})

setup("create victim user for admin tests", async ({ request }) => {
  await signInOrRegister(
    request,
    process.env.TEST_VICTIM_EMAIL!,
    process.env.TEST_VICTIM_PASSWORD!,
    "Test Victim",
  )
})
