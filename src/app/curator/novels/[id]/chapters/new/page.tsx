import { getNovelById, listChaptersByNovel } from "@/modules/content"
import { notFound } from "next/navigation"
import { ChapterForm } from "../_components/chapter-form"

export default async function NewChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [novel, chapters] = await Promise.all([getNovelById(id), listChaptersByNovel(id, true)])
  if (!novel) notFound()

  const nextNumber = chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1 : 1

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">New Chapter</h1>
      <p className="text-muted-foreground text-sm mb-6">{novel.title}</p>
      <ChapterForm novelId={id} nextChapterNumber={nextNumber} />
    </div>
  )
}
