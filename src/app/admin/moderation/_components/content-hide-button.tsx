"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface Props {
  id: string
  type: "comments" | "reviews"
  hidden: boolean
}

export function ContentHideButton({ id, type, hidden }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/${type}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !hidden }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success(hidden ? "Đã hiện nội dung" : "Đã ẩn nội dung")
      router.refresh()
    } else {
      toast.error("Thao tác thất bại")
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-2 py-1 rounded border disabled:opacity-50 ${
        hidden
          ? "border-green-300 text-green-700 hover:bg-green-50"
          : "border-orange-300 text-orange-700 hover:bg-orange-50"
      }`}
    >
      {hidden ? "Hiện" : "Ẩn"}
    </button>
  )
}
