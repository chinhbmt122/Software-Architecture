"use client"

import { useState } from "react"
import Link from "next/link"
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
    }).catch(() => {})
    setLoading(false)
    // Always show confirmation regardless of outcome (BR-05-1: no email enumeration)
    setSent(true)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Quên mật khẩu</CardTitle>
        <CardDescription>
          {sent ? "Kiểm tra hộp thư của bạn" : "Nhập email để nhận liên kết đặt lại mật khẩu"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chúng tôi đã gửi email đến <strong>{email}</strong>. Kiểm tra hộp thư (và thư rác) để tìm liên kết đặt lại mật khẩu.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ban@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Đang gửi..." : "Gửi liên kết đặt lại"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground hover:text-foreground underline">
          Quay lại đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}
