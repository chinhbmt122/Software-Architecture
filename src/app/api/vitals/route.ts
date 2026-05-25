import { logger } from "@/lib/logger"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const metric = await req.json()
    logger.info({ type: "web-vital", name: metric.name, value: metric.value, rating: metric.rating, id: metric.id })
  } catch {
    // Malformed payload — ignore silently
  }
  return new NextResponse(null, { status: 204 })
}
