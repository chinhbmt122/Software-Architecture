"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
  novelId: string
  isLoggedIn: boolean
}

export function FollowButton({ novelId, isLoggedIn }: Props) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return }
    fetch(`/api/novels/${novelId}/follow`)
      .then((r) => r.json())
      .then((d) => setFollowing(d.following))
      .finally(() => setLoading(false))
  }, [novelId, isLoggedIn])

  async function toggle() {
    if (!isLoggedIn) { toast.error("Đăng nhập để theo dõi"); return }
    const prev = following
    setFollowing(!following)
    const res = await fetch(`/api/novels/${novelId}/follow`, { method: "POST" })
    if (res.ok) {
      const d = await res.json()
      setFollowing(d.following)
      toast.success(d.following ? "Đã theo dõi truyện" : "Đã bỏ theo dõi")
    } else {
      setFollowing(prev)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={following ? "bg-primary/10 border-primary/30 text-primary" : "bg-background/50 backdrop-blur-sm"}
    >
      {following ? <BellOff className="h-4 w-4 mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
      {following ? "Đang theo dõi" : "+ Theo dõi"}
    </Button>
  )
}
