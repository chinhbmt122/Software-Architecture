import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { isFollowing, toggleFollow } from "@/modules/reader"

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ following: false })
  const { id } = await params
  const following = await isFollowing(session.user.id, id)
  return NextResponse.json({ following })
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const following = await toggleFollow(session.user.id, id)
  return NextResponse.json({ following })
}
