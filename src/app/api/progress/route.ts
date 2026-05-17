import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readingProgress } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { novelId, chapterId, scrollPosition } = await req.json()
  if (!novelId || !chapterId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  await db
    .insert(readingProgress)
    .values({
      userId: session.user.id,
      novelId,
      chapterId,
      scrollPosition: scrollPosition ?? 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.chapterId],
      set: { scrollPosition: scrollPosition ?? 0, updatedAt: new Date() },
    })

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json(null)

  const novelId = req.nextUrl.searchParams.get("novelId")
  if (!novelId) return NextResponse.json(null)

  const [progress] = await db
    .select()
    .from(readingProgress)
    .where(and(eq(readingProgress.userId, session.user.id), eq(readingProgress.novelId, novelId)))
    .orderBy(readingProgress.updatedAt)
    .limit(1)

  return NextResponse.json(progress ?? null)
}
