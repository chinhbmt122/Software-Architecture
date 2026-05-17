import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import {
  coinTransactionTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  paymentTypeEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum,
} from "./enums"
import { users } from "./auth"
import { chapters } from "./content"

export const coinPackages = pgTable("coin_packages", {
  id: serial("id").primaryKey(),
  coins: integer("coins").notNull(),
  bonusCoins: integer("bonus_coins").notNull().default(0),
  priceVnd: integer("price_vnd").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  coinPackageId: integer("coin_package_id").references(() => coinPackages.id),
  amountVnd: integer("amount_vnd").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  externalTransactionId: text("external_transaction_id"),
  type: paymentTypeEnum("type").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const coinTransactions = pgTable("coin_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: coinTransactionTypeEnum("type").notNull(),
  referenceId: uuid("reference_id"),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const chapterUnlocks = pgTable(
  "chapter_unlocks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    coinsSpent: integer("coins_spent").notNull(),
    unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chapterId] })],
)

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  paymentId: uuid("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
