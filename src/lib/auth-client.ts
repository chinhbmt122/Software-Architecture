"use client"

import { createAuthClient } from "better-auth/react"
import { dashClient } from "@better-auth/infra/client"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [dashClient()],
})

export const { signIn, signOut, signUp, useSession } = authClient
