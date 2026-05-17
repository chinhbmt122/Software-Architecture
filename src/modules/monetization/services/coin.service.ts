import { db } from "@/lib/db"
import { coinPackages, coinTransactions, payments } from "@/db/schema/monetization"
import { users } from "@/db/schema/auth"
import { eq, sql } from "drizzle-orm"

export async function listActiveCoinPackages() {
  return db
    .select()
    .from(coinPackages)
    .where(eq(coinPackages.isActive, true))
    .orderBy(coinPackages.priceVnd)
}

export async function getCoinBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ coinBalance: users.coinBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.coinBalance ?? 0
}

export async function creditCoins(
  userId: string,
  amount: number,
  paymentId: string,
): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ coinBalance: sql`${users.coinBalance} + ${amount}` })
    .where(eq(users.id, userId))
    .returning({ coinBalance: users.coinBalance })

  const newBalance = updated.coinBalance

  await db.insert(coinTransactions).values({
    userId,
    amount,
    type: "PURCHASE",
    referenceId: paymentId,
    balanceAfter: newBalance,
  })

  return newBalance
}

export async function deductCoins(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<number> {
  const [user] = await db
    .select({ coinBalance: users.coinBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || user.coinBalance < amount) {
    throw new Error("Insufficient coins")
  }

  const [updated] = await db
    .update(users)
    .set({ coinBalance: sql`${users.coinBalance} - ${amount}` })
    .where(eq(users.id, userId))
    .returning({ coinBalance: users.coinBalance })

  const newBalance = updated.coinBalance

  await db.insert(coinTransactions).values({
    userId,
    amount: -amount,
    type: "UNLOCK",
    referenceId,
    balanceAfter: newBalance,
  })

  return newBalance
}
