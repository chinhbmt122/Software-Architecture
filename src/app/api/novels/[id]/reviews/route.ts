import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { listNovelReviews, upsertReview, getMyReview } from "@/modules/community"
import { z } from "zod"

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  const result = await listNovelReviews(id, session?.user.id ?? null, cursor)

  let myReview = null
  if (session) myReview = await getMyReview(id, session.user.id)

  return NextResponse.json({ ...result, myReview })
}

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const review = await upsertReview(id, session.user.id, parsed.data.rating, parsed.data.body ?? null)
  return NextResponse.json(review, { status: 201 })
}
