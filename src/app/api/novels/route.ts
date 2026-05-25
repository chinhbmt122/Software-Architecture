import { auth } from "@/lib/auth"
import { createNovel, createNovelSchema, listNovels } from "@/modules/content"
import { buildNovelDoc, indexNovel, searchNovels } from "@/modules/search"
import { writeAuditLog } from "@/modules/admin"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const NOVEL_STATUSES = new Set(["ONGOING", "COMPLETED", "HIATUS", "DROPPED"])
const NOVEL_SORTS = new Set(["trending", "rating", "chapters"])
const PAGE_SIZE = 30

function optionalPositiveInt(value: string | null, fallback: number, min = 0) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= min ? parsed : fallback
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const rawStatus = searchParams.get("status")?.toUpperCase()
  const status = rawStatus && NOVEL_STATUSES.has(rawStatus) ? rawStatus : undefined
  const rawGenreId = searchParams.get("genreId") ?? searchParams.get("genre")
  const genreId = rawGenreId && /^\d+$/.test(rawGenreId) ? Number(rawGenreId) : undefined
  const rawSort = searchParams.get("sort")
  const sort = rawSort && NOVEL_SORTS.has(rawSort) ? rawSort : undefined
  const page = optionalPositiveInt(searchParams.get("page"), 1, 1)
  const offset = searchParams.has("page")
    ? (page - 1) * PAGE_SIZE
    : optionalPositiveInt(searchParams.get("offset"), 0)

  const q = searchParams.get("q")?.trim()
  const novels = q
    ? await searchNovels(q, { status, genreId, limit: PAGE_SIZE, offset })
    : await listNovels({
        status,
        genreId,
        isFeatured: searchParams.get("featured") === "true" ? true : undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      })
  return NextResponse.json(novels)
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createNovelSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const novel = await createNovel(parsed.data, session.user.id)
  void buildNovelDoc(novel.id).then((doc) => doc && indexNovel(doc))
  void writeAuditLog(session.user.id, "CREATE_NOVEL", "NOVEL", novel.id, { title: novel.title })
  return NextResponse.json(novel, { status: 201 })
}
