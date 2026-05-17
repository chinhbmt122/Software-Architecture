import { getNovelById } from "@/modules/content"
import { notFound } from "next/navigation"
import { NovelForm } from "../_components/novel-form"

export default async function EditNovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const novel = await getNovelById(id)
  if (!novel) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Novel</h1>
      <NovelForm
        novelId={id}
        defaultValues={{
          title: novel.title,
          synopsis: novel.synopsis ?? undefined,
          coverImageUrl: novel.coverImageUrl ?? undefined,
          status: novel.status,
          originalLanguage: novel.originalLanguage,
          isFeatured: novel.isFeatured,
        }}
      />
    </div>
  )
}
