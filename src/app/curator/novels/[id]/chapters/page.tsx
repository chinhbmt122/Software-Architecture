import { getNovelById, listChaptersByNovel } from "@/modules/content"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowLeft } from "lucide-react"
import { DeleteChapterButton } from "./_components/delete-chapter-button"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  SCHEDULED: "secondary",
  DRAFT: "outline",
}

export default async function ChapterListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [novel, chapterList] = await Promise.all([getNovelById(id), listChaptersByNovel(id, true)])
  if (!novel) notFound()

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/curator/novels"><ArrowLeft className="h-4 w-4 mr-1" /> Novels</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{novel.title}</h1>
          <p className="text-muted-foreground text-sm">{chapterList.length} chapters</p>
        </div>
        <Button asChild>
          <Link href={`/curator/novels/${id}/chapters/new`}>
            <Plus className="h-4 w-4 mr-1" /> New Chapter
          </Link>
        </Button>
      </div>

      {chapterList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No chapters yet.</p>
          <Button asChild variant="outline">
            <Link href={`/curator/novels/${id}/chapters/new`}>Add first chapter</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>VIP</TableHead>
              <TableHead>Words</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chapterList.map((ch) => (
              <TableRow key={ch.id}>
                <TableCell className="font-mono text-sm">{ch.chapterNumber}</TableCell>
                <TableCell>{ch.title}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[ch.status]}>{ch.status}</Badge>
                </TableCell>
                <TableCell>{ch.isVip ? `${ch.coinCost} coin` : "Free"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{ch.wordCount.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/curator/novels/${id}/chapters/${ch.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteChapterButton chapterId={ch.id} novelId={id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
