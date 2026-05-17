import { NextRequest, NextResponse } from "next/server"
import { verifyMomoIpn, completeMomoPayment } from "@/modules/monetization"
import { db } from "@/lib/db"
import { payments } from "@/db/schema/monetization"
import { eq } from "drizzle-orm"

// MoMo calls this IPN endpoint after payment completes
export async function POST(req: NextRequest) {
  const payload = await req.json()

  const valid = await verifyMomoIpn(payload)
  if (!valid) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
  }

  const { orderId, transId, resultCode } = payload

  if (resultCode !== 0) {
    // Payment failed — mark as failed
    await db
      .update(payments)
      .set({ status: "FAILED" })
      .where(eq(payments.id, orderId))
    return NextResponse.json({ message: "ok" })
  }

  try {
    await completeMomoPayment(orderId, transId)
  } catch (err) {
    console.error("MoMo IPN processing error:", err)
    return NextResponse.json({ message: "Processing error" }, { status: 500 })
  }

  return NextResponse.json({ message: "ok" })
}
