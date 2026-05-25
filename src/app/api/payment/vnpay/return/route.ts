import { NextRequest, NextResponse } from "next/server"
import { verifyVnpayReturn, completeVnpayPayment } from "@/modules/monetization"
import { db } from "@/lib/db"
import { payments } from "@/db/schema/monetization"
import { eq } from "drizzle-orm"
import { logger } from "@/lib/logger"

// VNPay redirects the user's browser here after payment (success or failure)
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin
  const searchParams = req.nextUrl.searchParams

  const params: Record<string, string> = {}
  searchParams.forEach((v, k) => { params[k] = v })

  const orderId = params.vnp_TxnRef
  const responseCode = params.vnp_ResponseCode
  const transactionNo = params.vnp_TransactionNo ?? ""

  if (!orderId) {
    return NextResponse.redirect(new URL("/pricing", origin))
  }

  const valid = verifyVnpayReturn(params)

  if (!valid || responseCode !== "00") {
    await db.update(payments).set({ status: "FAILED" }).where(eq(payments.id, orderId))
    return NextResponse.redirect(
      new URL(`/payment/complete?orderId=${orderId}&method=vnpay&resultCode=1`, origin),
    )
  }

  try {
    await completeVnpayPayment(orderId, transactionNo)
    logger.info({ orderId, transactionNo }, "VNPay payment completed")
  } catch (err) {
    logger.error({ err, orderId }, "VNPay return processing error")
    return NextResponse.redirect(
      new URL(`/payment/complete?orderId=${orderId}&method=vnpay&resultCode=1`, origin),
    )
  }

  return NextResponse.redirect(
    new URL(`/payment/complete?orderId=${orderId}&method=vnpay`, origin),
  )
}
