import crypto from "node:crypto"
import { db } from "@/lib/db"
import { payments, coinPackages, coinTransactions } from "@/db/schema/monetization"
import { users } from "@/db/schema/auth"
import { and, eq, sql } from "drizzle-orm"

const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE ?? "TESTPHI2"
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET ?? "G3Z2FW7ICJVJQHZPWRBLYN5CTNKJ0PU6"
const VNPAY_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

function hmacSHA512(data: string, key: string): string {
  return crypto.createHmac("sha512", key).update(Buffer.from(data, "utf-8")).digest("hex")
}

function vnpayDate(date: Date): string {
  // VNPay requires YYYYMMDDHHmmss in UTC+7
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return vn.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
}

// Build signature string: sorted keys, raw (non-encoded) values
function buildSignatureString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter(k => params[k] !== "")
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&")
}

export async function createVnpayPayment(
  userId: string,
  packageId: number,
  appUrl: string,
  ipAddr: string,
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
      paymentMethod: "VNPAY",
      type: "COIN_PURCHASE",
      status: "PENDING",
    })
    .returning({ id: payments.id })

  const orderId = payment.id
  const returnUrl = `${appUrl}/api/payment/vnpay/return`

  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_Amount: String(pkg.priceVnd * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `NovelHub ${pkg.coins + pkg.bonusCoins} xu`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: vnpayDate(new Date()),
  }

  const signature = hmacSHA512(buildSignatureString(params), VNPAY_HASH_SECRET)

  // URL uses encoded values; signature uses raw values (VNPay spec)
  const queryString = Object.keys(params)
    .sort()
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join("&")

  const payUrl = `${VNPAY_PAYMENT_URL}?${queryString}&vnp_SecureHash=${signature}`

  return { payUrl, paymentId: orderId }
}

export function verifyVnpayReturn(queryParams: Record<string, string>): boolean {
  const secureHash = queryParams.vnp_SecureHash
  if (!secureHash) return false

  const filtered: Record<string, string> = {}
  for (const [k, v] of Object.entries(queryParams)) {
    if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") {
      filtered[k] = v
    }
  }

  const expected = hmacSHA512(buildSignatureString(filtered), VNPAY_HASH_SECRET)
  return expected === secureHash
}

export async function completeVnpayPayment(
  orderId: string,
  vnpTransactionNo: string,
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
  if (payment.status === "SUCCESS") return

  const [pkg] = await db
    .select({ coins: coinPackages.coins, bonusCoins: coinPackages.bonusCoins })
    .from(coinPackages)
    .where(eq(coinPackages.id, payment.coinPackageId!))
    .limit(1)

  if (!pkg) throw new Error("Package not found")

  const totalCoins = pkg.coins + pkg.bonusCoins

  const [claimed] = await db
    .update(payments)
    .set({ status: "SUCCESS", externalTransactionId: vnpTransactionNo })
    .where(and(eq(payments.id, orderId), eq(payments.status, "PENDING")))
    .returning({ id: payments.id })

  if (!claimed) return

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
