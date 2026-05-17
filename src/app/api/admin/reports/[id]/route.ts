import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { resolveReport } from "@/modules/admin"
import { z } from "zod"

const bodySchema = z.object({ resolution: z.enum(["RESOLVED", "DISMISSED"]) })

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  await resolveReport(id, session.user.id, parsed.data.resolution)
  return NextResponse.json({ success: true })
}
