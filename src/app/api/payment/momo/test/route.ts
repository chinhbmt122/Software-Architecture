import { NextRequest, NextResponse } from "next/server"
import { completeMomoPayment } from "@/modules/monetization"

// Dev-only: simulate a successful MoMo payment without real webhook
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const { orderId } = await req.json()
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  try {
    await completeMomoPayment(orderId, `TEST_${Date.now()}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
