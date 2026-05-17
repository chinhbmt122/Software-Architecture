"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  name: string
  bio: string
  email: string
}

export function ProfileForm({ name: initialName, bio: initialBio, email }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [bio, setBio] = useState(initialBio)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await authClient.updateUser({ name, bio } as never)
    setLoading(false)
    if (error) {
      toast.error((error as { message?: string }).message ?? "Cập nhật thất bại")
    } else {
      toast.success("Đã lưu thay đổi")
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled className="bg-muted/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tên hiển thị</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Giới thiệu</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Viết vài dòng về bản thân..."
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/300</p>
      </div>
      <Button type="submit" disabled={loading} className="self-start">
        {loading ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  )
}
