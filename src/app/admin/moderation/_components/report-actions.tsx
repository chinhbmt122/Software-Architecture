"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function resolve(resolution: "RESOLVED" | "DISMISSED") {
    setLoading(true)
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(resolution === "RESOLVED" ? "Đã giải quyết" : "Đã bỏ qua")
      router.refresh()
    } else {
      toast.error("Thao tác thất bại")
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => resolve("RESOLVED")}
        disabled={loading}
        className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
      >
        Giải quyết
      </button>
      <button
        onClick={() => resolve("DISMISSED")}
        disabled={loading}
        className="text-xs px-2 py-1 rounded border border-muted-foreground/30 text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        Bỏ qua
      </button>
    </div>
  )
}
