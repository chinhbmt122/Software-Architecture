import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { coinPackages } from "../src/db/schema/monetization"
import { eq } from "drizzle-orm"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

const PACKAGES = [
  { coins: 100,  bonusCoins: 0,   priceVnd: 10_000 },
  { coins: 500,  bonusCoins: 50,  priceVnd: 45_000 },
  { coins: 1000, bonusCoins: 150, priceVnd: 85_000 },
  { coins: 2000, bonusCoins: 400, priceVnd: 160_000 },
  { coins: 5000, bonusCoins: 1500, priceVnd: 380_000 },
]

async function main() {
  console.log("Seeding coin packages...")

  for (const pkg of PACKAGES) {
    // Upsert by priceVnd to avoid duplicates on re-run
    const [existing] = await db
      .select({ id: coinPackages.id })
      .from(coinPackages)
      .where(eq(coinPackages.priceVnd, pkg.priceVnd))
      .limit(1)

    if (existing) {
      await db
        .update(coinPackages)
        .set({ ...pkg, isActive: true })
        .where(eq(coinPackages.id, existing.id))
      console.log(`  Updated: ${pkg.coins}+${pkg.bonusCoins} xu — ${pkg.priceVnd.toLocaleString()}đ`)
    } else {
      await db.insert(coinPackages).values({ ...pkg, isActive: true })
      console.log(`  Inserted: ${pkg.coins}+${pkg.bonusCoins} xu — ${pkg.priceVnd.toLocaleString()}đ`)
    }
  }

  console.log("Done!")
}

main().catch((e) => { console.error(e); process.exit(1) })
