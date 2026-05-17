"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, Coins } from "lucide-react"

type Status = "loading" | "success" | "failed" | "dev_success"

export function PaymentCompleteClient() {
  const params = useSearchParams()
  const orderId = params.get("orderId")
  const resultCode = params.get("resultCode")

  const [status, setStatus] = useState<Status>("loading")
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!orderId) { setStatus("failed"); return }

    // In dev, MoMo sandbox redirects with resultCode=0 on success
    // but the IPN may not have fired yet — use the test endpoint to trigger credit
    async function finalize() {
      const isSuccess = resultCode === "0" || resultCode === null

      if (isSuccess && process.env.NODE_ENV !== "production") {
        // Trigger server-side credit via test endpoint
        await fetch("/api/payment/momo/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        })
      }

      const balRes = await fetch("/api/payment/balance")
      if (balRes.ok) {
        const { balance: b } = await balRes.json()
        setBalance(b)
      }

      setStatus(isSuccess ? "dev_success" : "failed")
    }

    finalize()
  }, [orderId, resultCode])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Đang xác nhận thanh toán...</p>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <XCircle className="h-16 w-16 text-destructive" />
        <div>
          <h1 className="text-xl font-bold">Thanh toán thất bại</h1>
          <p className="text-muted-foreground text-sm mt-1">Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/pricing">Thử lại</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div>
        <h1 className="text-xl font-bold">Thanh toán thành công!</h1>
        <p className="text-muted-foreground text-sm mt-1">Xu đã được cộng vào tài khoản của bạn.</p>
      </div>
      {balance !== null && (
        <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-5 py-2 text-amber-600">
          <Coins className="h-4 w-4" />
          <span className="font-semibold">Số dư: {balance.toLocaleString()} xu</span>
        </div>
      )}
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/novels">Đọc truyện</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing">Nạp thêm</Link>
        </Button>
      </div>
    </div>
  )
}
