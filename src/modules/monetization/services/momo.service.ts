import crypto from "node:crypto"
import { db } from "@/lib/db"
import { payments, coinPackages, coinTransactions } from "@/db/schema/monetization"
import { users } from "@/db/schema/auth"
import { and, eq, sql } from "drizzle-orm"

const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE ?? "MOMO"
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY ?? "F8BBA842ECF85"
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY ?? "K951B6PE1waDMi640xX08PD3vg6EkVlz"
const MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create"

function hmacSHA256(data: string, key: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex")
}

export async function createMomoPayment(
  userId: string,
  packageId: number,
  appUrl: string,
): Promise<{ payUrl: string; paymentId: string }> {
  const [pkg] = await db
    .select()
    .from(coinPackages)
    .where(eq(coinPackages.id, packageId))
    .limit(1)

  if (!pkg || !pkg.isActive) throw new Error("Invalid package")

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      coinPackageId: pkg.id,
      amountVnd: pkg.priceVnd,
      paymentMethod: "MOMO",
      type: "COIN_PURCHASE",
      status: "PENDING",
    })
    .returning({ id: payments.id })

  const orderId = payment.id
  const requestId = orderId
  const amount = pkg.priceVnd
  const orderInfo = `NovelHub - ${pkg.coins + pkg.bonusCoins} xu`
  const redirectUrl = `${appUrl}/payment/complete?orderId=${orderId}`
  const ipnUrl = `${appUrl}/api/payment/momo/webhook`
  const extraData = ""
  const requestType = "payWithMethod"

  const rawSignature = [
    `accessKey=${MOMO_ACCESS_KEY}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${MOMO_PARTNER_CODE}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&")

  const signature = hmacSHA256(rawSignature, MOMO_SECRET_KEY)

  const body = {
    partnerCode: MOMO_PARTNER_CODE,
    accessKey: MOMO_ACCESS_KEY,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: "vi",
  }

  const res = await fetch(MOMO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`MoMo API error: ${res.status}`)

  const data = await res.json() as { resultCode: number; payUrl?: string; message?: string }

  if (data.resultCode !== 0 || !data.payUrl) {
    throw new Error(data.message ?? "MoMo returned error")
  }

  await db
    .update(payments)
    .set({ externalTransactionId: orderId })
    .where(eq(payments.id, orderId))

  return { payUrl: data.payUrl, paymentId: orderId }
}

interface MomoIpnPayload {
  partnerCode: string
  orderId: string
  requestId: string
  amount: number
  orderInfo: string
  orderType: string
  transId: number
  resultCode: number
  message: string
  payType: string
  responseTime: number
  extraData: string
  signature: string
}

export async function verifyMomoIpn(payload: MomoIpnPayload): Promise<boolean> {
  const {
    partnerCode, orderId, requestId, amount, orderInfo,
    orderType, transId, resultCode, message, payType,
    responseTime, extraData, signature,
  } = payload

  const rawSignature = [
    `accessKey=${MOMO_ACCESS_KEY}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join("&")

  const expected = hmacSHA256(rawSignature, MOMO_SECRET_KEY)
  return expected === signature
}

export async function completeMomoPayment(
  orderId: string,
  momoTransId: string | number,
): Promise<void> {
  const [payment] = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      coinPackageId: payments.coinPackageId,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.id, orderId))
    .limit(1)

  if (!payment) throw new Error("Payment not found")
  if (payment.status === "SUCCESS") return // idempotent

  const [pkg] = await db
    .select({ coins: coinPackages.coins, bonusCoins: coinPackages.bonusCoins })
    .from(coinPackages)
    .where(eq(coinPackages.id, payment.coinPackageId!))
    .limit(1)

  if (!pkg) throw new Error("Package not found")

  const totalCoins = pkg.coins + pkg.bonusCoins

  // Claim the payment atomically: only succeeds if still PENDING (race guard)
  const [claimed] = await db
    .update(payments)
    .set({ status: "SUCCESS", externalTransactionId: String(momoTransId) })
    .where(and(eq(payments.id, orderId), eq(payments.status, "PENDING")))
    .returning({ id: payments.id })

  if (!claimed) return // another process already handled it

  // Credit coins + ledger
  const [updated] = await db
    .update(users)
    .set({ coinBalance: sql`${users.coinBalance} + ${totalCoins}` })
    .where(eq(users.id, payment.userId))
    .returning({ coinBalance: users.coinBalance })

  await db.insert(coinTransactions).values({
    userId: payment.userId,
    amount: totalCoins,
    type: "PURCHASE",
    referenceId: payment.id,
    balanceAfter: updated.coinBalance,
  })
}
