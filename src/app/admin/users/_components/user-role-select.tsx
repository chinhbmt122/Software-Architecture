"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

const ROLES = ["READER", "CURATOR", "ADMIN"] as const

export function UserRoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleChange(role: string) {
    setLoading(true)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Đã cập nhật vai trò")
      router.refresh()
    } else {
      toast.error("Cập nhật thất bại")
    }
  }

  return (
    <select
      defaultValue={currentRole}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border rounded px-2 py-1 bg-background disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}
