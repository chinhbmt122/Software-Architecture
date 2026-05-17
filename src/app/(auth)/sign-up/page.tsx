"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await authClient.signUp.email({ name, email, password })

    if (error) {
      setError(error.message ?? "Đăng ký thất bại")
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Đăng ký</CardTitle>
        <CardDescription>Tạo tài khoản mới</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Tên hiển thị</Label>
            <Input
              id="name"
              type="text"
              placeholder="Tên của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
          </Button>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">hoặc</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Tiếp tục với Google
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <span className="text-muted-foreground">Đã có tài khoản?&nbsp;</span>
        <Link href="/sign-in" className="underline">
          Đăng nhập
        </Link>
      </CardFooter>
    </Card>
  )
}
