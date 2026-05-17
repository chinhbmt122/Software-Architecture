"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

export function DeleteChapterButton({ chapterId, novelId }: { chapterId: string; novelId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm("Delete this chapter? This cannot be undone.")) return
    const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete chapter")
      return
    }
    toast.success("Chapter deleted")
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
