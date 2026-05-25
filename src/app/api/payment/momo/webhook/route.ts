import { NextRequest, NextResponse } from "next/server"
import { verifyMomoIpn, completeMomoPayment } from "@/modules/monetization"
import { logger } from "@/lib/logger"
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
    logger.info({ orderId, transId }, "MoMo payment completed")
  } catch (err) {
    logger.error({ err, orderId, transId }, "MoMo IPN processing error")
    return NextResponse.json({ message: "Processing error" }, { status: 500 })
  }

  return NextResponse.json({ message: "ok" })
}
