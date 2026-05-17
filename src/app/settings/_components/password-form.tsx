"use client"

import { useState } from "react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      toast.error("Mật khẩu xác nhận không khớp")
      return
    }
    if (next.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự")
      return
    }
    setLoading(true)
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message ?? "Đổi mật khẩu thất bại")
    } else {
      toast.success("Đã đổi mật khẩu thành công")
      setCurrent("")
      setNext("")
      setConfirm("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
        <Input
          id="current-password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Mật khẩu mới</Label>
        <Input
          id="new-password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="self-start">
        {loading ? "Đang lưu..." : "Đổi mật khẩu"}
      </Button>
    </form>
  )
}
