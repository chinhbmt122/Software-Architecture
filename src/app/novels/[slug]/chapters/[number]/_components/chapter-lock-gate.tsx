"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Coins, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  novelId: string
  chapterId: string
  coinCost: number
  coinBalance: number
  isLoggedIn: boolean
  theme: { container: string; bar: string; text: string }
}

export function ChapterLockGate({ novelId, chapterId, coinCost, coinBalance, isLoggedIn, theme }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const canAfford = coinBalance >= coinCost

  async function handleUnlock() {
    setLoading(true)
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}/unlock`, {
        method: "POST",
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          toast.error("Không đủ xu. Hãy nạp thêm xu!")
        } else {
          toast.error(data.error ?? "Mở khóa thất bại")
        }
        return
      }

      toast.success(`Mở khóa thành công! Số dư: ${data.newBalance.toLocaleString()} xu`)
      router.refresh()
    } catch {
      toast.error("Lỗi kết nối")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("min-h-[60vh] flex items-center justify-center px-4", theme.container)}>
      <div className="text-center max-w-sm w-full">
        {/* Lock icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-full bg-amber-500/10 p-5">
            <Lock className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <h2 className="text-lg font-bold mb-1">Chương VIP</h2>
        <p className={cn("text-sm mb-6", theme.text)}>
          Chương này yêu cầu mở khóa để đọc.
        </p>

        {!isLoggedIn ? (
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/sign-in">Đăng nhập để mở khóa</Link>
            </Button>
            <p className={cn("text-xs", theme.text)}>
              Cần có tài khoản để sử dụng xu.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Coin info */}
            <div className={cn("rounded-lg border p-4 space-y-2", theme.bar)}>
              <div className="flex items-center justify-between text-sm">
                <span className={theme.text}>Chi phí mở khóa</span>
                <span className="flex items-center gap-1 font-semibold text-amber-500">
                  <Coins className="h-3.5 w-3.5" />
                  {coinCost} xu
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={theme.text}>Số dư của bạn</span>
                <span className={cn("flex items-center gap-1 font-semibold", canAfford ? "text-emerald-500" : "text-destructive")}>
                  <Coins className="h-3.5 w-3.5" />
                  {coinBalance.toLocaleString()} xu
                </span>
              </div>
            </div>

            {canAfford ? (
              <Button onClick={handleUnlock} disabled={loading} className="w-full">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang mở khóa...</>
                ) : (
                  <>Mở khóa — {coinCost} xu</>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/pricing">Nạp xu ngay</Link>
                </Button>
                <p className={cn("text-xs", theme.text)}>
                  Thiếu {coinCost - coinBalance} xu để mở khóa chương này.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
