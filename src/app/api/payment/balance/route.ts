import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getCoinBalance } from "@/modules/monetization"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const balance = await getCoinBalance(session.user.id)
  return NextResponse.json({ balance })
}
