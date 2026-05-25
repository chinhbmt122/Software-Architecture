"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      onClick={handleSignOut}
      disabled={loading}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  )
}
