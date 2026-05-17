import { listActiveCoinPackages } from "@/modules/monetization"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { BuyButton } from "./_components/buy-button"
import { Coins } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Nạp xu",
  description: "Nạp xu để đọc chương VIP trên NovelHub",
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
}

export default async function PricingPage() {
  const [packages, session] = await Promise.all([
    listActiveCoinPackages(),
    auth.api.getSession({ headers: await headers() }),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Coins className="h-7 w-7 text-amber-500" />
          <h1 className="text-2xl font-bold">Nạp xu</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Dùng xu để mở khoá chương VIP. 1 xu = 1 chương VIP.
        </p>
      </div>

      {!session && (
        <div className="mb-8 rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Vui lòng{" "}
          <Link href="/sign-in" className="text-primary underline underline-offset-2">
            đăng nhập
          </Link>{" "}
          để nạp xu.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const totalCoins = pkg.coins + pkg.bonusCoins
          const popular = pkg.priceVnd === 85_000

          return (
            <div
              key={pkg.id}
              className={`relative rounded-xl border p-5 flex flex-col gap-4 ${
                popular ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">
                  Phổ biến
                </span>
              )}

              <div>
                <div className="flex items-center gap-1.5">
                  <Coins className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold">{pkg.coins.toLocaleString()}</span>
                  {pkg.bonusCoins > 0 && (
                    <span className="text-sm text-emerald-500 font-semibold">
                      +{pkg.bonusCoins} bonus
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tổng: {totalCoins.toLocaleString()} xu
                </p>
              </div>

              <p className="text-xl font-semibold">{formatVnd(pkg.priceVnd)}</p>

              {session ? (
                <BuyButton
                  packageId={pkg.id}
                  label={`Mua ${totalCoins.toLocaleString()} xu`}
                />
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/sign-in">Đăng nhập để mua</Link>
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Thanh toán qua MoMo Sandbox (môi trường thử nghiệm). Không trừ tiền thật.
      </p>
    </main>
  )
}
