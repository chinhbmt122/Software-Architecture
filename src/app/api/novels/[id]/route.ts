import { auth } from "@/lib/auth"
import { deleteNovel, getNovelById, updateNovel, updateNovelSchema } from "@/modules/content"
import { buildNovelDoc, indexNovel } from "@/modules/search"
import { writeAuditLog } from "@/modules/admin"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireCurator(role: string) {
  return role !== "CURATOR" && role !== "ADMIN"
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
  void writeAuditLog(session.user.id, "UPDATE_NOVEL", "NOVEL", id, { title: novel.title })
  return NextResponse.json(novel)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (requireCurator(session.user.role as string))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await deleteNovel(id)
  void writeAuditLog(session.user.id, "DELETE_NOVEL", "NOVEL", id, {})
  return new NextResponse(null, { status: 204 })
}
