"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
  packageId: number
  label: string
  method: "momo" | "vnpay"
}

export function BuyButton({ packageId, label, method }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/payment/${method}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Không thể tạo thanh toán")
        return
      }
      window.location.href = data.payUrl
    } catch {
      toast.error("Lỗi kết nối")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={method === "vnpay" ? "outline" : "default"}
      className="w-full"
    >
      {loading ? "Đang xử lý..." : label}
    </Button>
  )
}
