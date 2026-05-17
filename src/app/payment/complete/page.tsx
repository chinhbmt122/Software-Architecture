import { Suspense } from "react"
import { PaymentCompleteClient } from "./_components/complete-client"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Kết quả thanh toán" }

export default function PaymentCompletePage() {
  return (
    <main className="max-w-md mx-auto px-4">
      <Suspense>
        <PaymentCompleteClient />
      </Suspense>
    </main>
  )
}
