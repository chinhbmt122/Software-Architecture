import { listGenres, listTags } from "@/modules/content"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type")
  if (type === "tags") {
    const tags = await listTags()
    return NextResponse.json(tags)
  }
  const genres = await listGenres()
  return NextResponse.json(genres)
}
