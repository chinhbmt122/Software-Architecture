import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"

type CheckStatus = "ok" | "degraded" | "down"

interface CheckResult {
  status: CheckStatus
  latencyMs: number
  error?: string
}

async function checkDb(): Promise<CheckResult> {
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - start, error: String(err) }
  }
}

async function checkRedis(): Promise<CheckResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { status: "degraded", latencyMs: 0, error: "not configured" }
  }
  const start = Date.now()
  try {
    const { redis } = await import("@/lib/redis")
    await redis.ping()
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (err) {
    return { status: "degraded", latencyMs: Date.now() - start, error: String(err) }
  }
}

async function checkSearch(): Promise<CheckResult> {
  if (!process.env.MEILISEARCH_URL) {
    return { status: "degraded", latencyMs: 0, error: "not configured" }
  }
  const start = Date.now()
  try {
    const { Meilisearch } = await import("meilisearch")
    const client = new Meilisearch({ host: process.env.MEILISEARCH_URL, apiKey: process.env.MEILISEARCH_API_KEY })
    await client.health()
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (err) {
    return { status: "degraded", latencyMs: Date.now() - start, error: String(err) }
  }
}

// GET /api/health
// Returns 200 when all critical dependencies are up, 503 when DB is down.
// Redis and Meilisearch are non-critical — their failure degrades but doesn't down the service.
export async function GET() {
  const [database, redis, search] = await Promise.all([checkDb(), checkRedis(), checkSearch()])

  const checks = { database, redis, search }
  const overallStatus: CheckStatus =
    database.status === "down" ? "down" : [redis, search].some((c) => c.status !== "ok") ? "degraded" : "ok"

  if (overallStatus !== "ok") {
    logger.warn({ checks, overallStatus }, "Health check non-ok")
  }

  const httpStatus = overallStatus === "down" ? 503 : 200

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: httpStatus },
  )
}
