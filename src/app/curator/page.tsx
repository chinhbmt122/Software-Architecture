import { db } from "@/lib/db"
import { novels, chapters } from "@/db/schema"
import { count } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, FileText, Plus } from "lucide-react"

export default async function CuratorDashboard() {
  const [[novelCount], [chapterCount]] = await Promise.all([
    db.select({ count: count() }).from(novels),
    db.select({ count: count() }).from(chapters),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/curator/novels/new">
            <Plus className="h-4 w-4 mr-1" /> New Novel
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Total Novels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{novelCount.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Total Chapters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{chapterCount.count}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
