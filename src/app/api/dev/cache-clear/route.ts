import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"

// Dev-only route to flush Redis cache
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }
  await redis.flushdb()
  return NextResponse.json({ ok: true, message: "Cache cleared" })
}
