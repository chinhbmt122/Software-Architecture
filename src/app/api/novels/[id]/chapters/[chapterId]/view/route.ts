import { incrementChapterViews } from "@/modules/content"
import { logger } from "@/lib/logger"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> },
) {
  const { id: novelId, chapterId } = await params
  setTimeout(() => {
    void incrementChapterViews(chapterId, novelId)
      .catch((err) => logger.warn({ err, novelId, chapterId }, "Chapter view increment failed"))
  }, 0)
  return NextResponse.json({ ok: true })
}
