import { test as setup, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

export const AUTH_FILE = "tests/.auth/user.json"

setup("authenticate as test user", async ({ request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const res = await request.post("/api/auth/sign-in/email", {
    data: {
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
      rememberMe: true,
    },
  })

  expect(res.ok(), `Sign-in failed (${res.status()}): check TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.test`).toBeTruthy()

  await request.storageState({ path: AUTH_FILE })
})
