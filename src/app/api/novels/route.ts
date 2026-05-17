import { auth } from "@/lib/auth"
import { createNovel, createNovelSchema, listNovels } from "@/modules/content"
import { buildNovelDoc, indexNovel } from "@/modules/search"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const novels = await listNovels({
    status: searchParams.get("status") ?? undefined,
    genreId: searchParams.get("genreId") ? Number(searchParams.get("genreId")) : undefined,
    search: searchParams.get("q") ?? undefined,
    isFeatured: searchParams.get("featured") === "true" ? true : undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
    offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
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
  return NextResponse.json(novel, { status: 201 })
}
