import { auth } from "@/lib/auth"
import { deleteNovel, getNovelById, updateNovel, updateNovelSchema } from "@/modules/content"
import { buildNovelDoc, indexNovel } from "@/modules/search"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

function requireCurator(role: string) {
  return role !== "CURATOR" && role !== "ADMIN"
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const novel = await getNovelById(id)
  if (!novel) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(novel)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (requireCurator(session.user.role as string))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = updateNovelSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const novel = await updateNovel(id, parsed.data)
  void buildNovelDoc(id).then((doc) => doc && indexNovel(doc))
  return NextResponse.json(novel)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (requireCurator(session.user.role as string))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await deleteNovel(id)
  return new NextResponse(null, { status: 204 })
}
