"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Suspense } from "react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <p className="text-sm text-destructive text-center py-4">
        Liên kết không hợp lệ hoặc đã hết hạn.{" "}
        <Link href="/forgot-password" className="underline">Thử lại</Link>
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp")
      return
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự")
      return
    }
    setLoading(true)
    setError("")
    const { error } = await authClient.resetPassword({ newPassword: password, token })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Có lỗi xảy ra")
    } else {
      setDone(true)
      setTimeout(() => router.push("/sign-in"), 2000)
    }
  }

  if (done) {
    return (
      <p className="text-sm text-center py-4">
        Mật khẩu đã được đặt lại. Đang chuyển hướng đến trang đăng nhập…
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mật khẩu mới</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Xác nhận mật khẩu</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Đặt lại mật khẩu</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground hover:text-foreground underline">
          Quay lại đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}
