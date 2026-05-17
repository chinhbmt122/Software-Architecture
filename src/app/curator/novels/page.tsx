import { listNovels } from "@/modules/content"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Star } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const STATUS_COLORS: Record<string, string> = {
  ONGOING: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  HIATUS: "bg-yellow-100 text-yellow-800",
  DROPPED: "bg-red-100 text-red-800",
}

export default async function CuratorNovelsPage() {
  const novels = await listNovels({ limit: 100 })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Novels</h1>
        <Button asChild>
          <Link href="/curator/novels/new">
            <Plus className="h-4 w-4 mr-1" /> New Novel
          </Link>
        </Button>
      </div>

      {novels.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No novels yet.</p>
          <Button asChild variant="outline">
            <Link href="/curator/novels/new">Create your first novel</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chapters</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {novels.map((novel) => (
              <TableRow key={novel.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {novel.isFeatured && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                    <span className="font-medium">{novel.title}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[novel.status]}`}>
                    {novel.status}
                  </span>
                </TableCell>
                <TableCell>{novel.totalChapters}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(novel.updatedAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/curator/novels/${novel.id}/chapters`}>Chapters</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/curator/novels/${novel.id}`}>Edit</Link>
                    </Button>
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
