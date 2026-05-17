import { getChapterById, getNovelById } from "@/modules/content"
import { notFound } from "next/navigation"
import { ChapterForm } from "../../_components/chapter-form"

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params
  const [novel, chapter] = await Promise.all([getNovelById(id), getChapterById(chapterId)])
  if (!novel || !chapter) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Edit Chapter {chapter.chapterNumber}</h1>
      <p className="text-muted-foreground text-sm mb-6">{novel.title}</p>
      <ChapterForm
        novelId={id}
        chapterId={chapterId}
        defaultValues={{
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          content: chapter.content,
          isVip: chapter.isVip,
          coinCost: chapter.coinCost ?? 1,
          status: chapter.status,
          publishedAt: chapter.publishedAt
            ? new Date(chapter.publishedAt).toISOString().slice(0, 16)
            : undefined,
        }}
      />
    </div>
  )
}
