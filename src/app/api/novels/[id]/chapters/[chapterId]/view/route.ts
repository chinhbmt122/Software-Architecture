import { incrementChapterViews } from "@/modules/content"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> },
) {
  const { id: novelId, chapterId } = await params
  await incrementChapterViews(chapterId, novelId)
  return NextResponse.json({ ok: true })
}
