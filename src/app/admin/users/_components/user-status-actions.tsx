"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Status = "ACTIVE" | "SUSPENDED" | "BANNED"

export function UserStatusActions({ userId, currentStatus }: { userId: string; currentStatus: Status }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setStatus(status: Status) {
    setLoading(true)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Đã cập nhật trạng thái")
      router.refresh()
    } else {
      toast.error("Cập nhật thất bại")
    }
  }

  const STATUS_LABEL: Record<Status, string> = {
    ACTIVE: "Hoạt động",
    SUSPENDED: "Tạm khóa",
    BANNED: "Cấm",
  }

  const STATUS_COLOR: Record<Status, string> = {
    ACTIVE: "text-green-600 bg-green-50 border-green-200",
    SUSPENDED: "text-yellow-600 bg-yellow-50 border-yellow-200",
    BANNED: "text-red-600 bg-red-50 border-red-200",
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[currentStatus]}`}>
        {STATUS_LABEL[currentStatus]}
      </span>
      {currentStatus !== "ACTIVE" && (
        <button
          onClick={() => setStatus("ACTIVE")}
          disabled={loading}
          className="text-xs text-green-700 hover:underline disabled:opacity-50"
        >
          Mở khóa
        </button>
      )}
      {currentStatus === "ACTIVE" && (
        <button
          onClick={() => setStatus("SUSPENDED")}
          disabled={loading}
          className="text-xs text-yellow-700 hover:underline disabled:opacity-50"
        >
          Tạm khóa
        </button>
      )}
      {currentStatus !== "BANNED" && (
        <button
          onClick={() => setStatus("BANNED")}
          disabled={loading}
          className="text-xs text-red-700 hover:underline disabled:opacity-50"
        >
          Cấm
        </button>
      )}
    </div>
  )
}
