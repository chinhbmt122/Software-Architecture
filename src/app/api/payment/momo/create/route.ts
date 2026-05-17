import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { createMomoPayment } from "@/modules/monetization"
import { z } from "zod"

const bodySchema = z.object({
  packageId: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  try {
    const result = await createMomoPayment(session.user.id, parsed.data.packageId, appUrl)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment creation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
