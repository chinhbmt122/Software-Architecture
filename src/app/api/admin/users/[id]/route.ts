import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { updateUserRole, updateUserStatus } from "@/modules/admin"
import { z } from "zod"

const bodySchema = z.union([
  z.object({ role: z.enum(["READER", "CURATOR", "ADMIN"]) }),
  z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]) }),
])

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  if ("role" in parsed.data) {
    await updateUserRole(id, parsed.data.role, session.user.id)
  } else {
    await updateUserStatus(id, parsed.data.status, session.user.id)
  }
  return NextResponse.json({ success: true })
}
