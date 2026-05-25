"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // digest is a stable hash Vercel assigns to server-side errors — safe to log publicly
    console.error("[route-error]", { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center px-4">
      <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message || "Có lỗi không mong đợi xảy ra. Vui lòng thử lại."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">ID: {error.digest}</p>
      )}
      <Button onClick={reset} variant="outline" size="sm">
        Thử lại
      </Button>
    </div>
  )
}
