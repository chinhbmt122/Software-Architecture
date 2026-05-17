import type { Metadata } from "next"
import { Inter, Lora, Geist_Mono } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { BookOpen, Search, Coins, UserCircle2 } from "lucide-react"
import Image from "next/image"
import { db } from "@/lib/db"
import { users } from "@/db/schema/auth"
import { eq } from "drizzle-orm"
import { getUnreadCount } from "@/modules/reader"
import { NotificationBell } from "@/components/notification-bell"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  display: "swap",
})
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
})
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" })

export const metadata: Metadata = {
  title: { default: "NovelHub", template: "%s | NovelHub" },
  description: "Đọc truyện dịch chất lượng cao",
}

const NAV_LINKS = [
  { label: "Thể loại", href: "/novels" },
  { label: "Bảng xếp hạng", href: "/novels?sort=trending" },
  { label: "Hoàn thành", href: "/novels?status=COMPLETED" },
]

async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() })
  const isCurator = session?.user.role === "CURATOR" || session?.user.role === "ADMIN"

  let coinBalance: number | null = null
  let unreadCount = 0
  if (session) {
    const [row] = await db
      .select({ coinBalance: users.coinBalance })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    coinBalance = row?.coinBalance ?? 0
    unreadCount = await getUnreadCount(session.user.id)
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-base shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
          NovelHub
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile: single nav link */}
        <nav className="flex md:hidden flex-1">
          <Link href="/novels" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Thư viện
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link href="/novels"><Search className="h-4 w-4" /></Link>
          </Button>

          {session ? (
            <>
              {isCurator && (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-sm">
                  <Link href="/curator">CMS</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-sm">
                <Link href="/library">Tủ sách</Link>
              </Button>
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-amber-500 hover:bg-amber-500/10 transition-colors"
              >
                <Coins className="h-3.5 w-3.5" />
                <span>{coinBalance?.toLocaleString() ?? "0"}</span>
              </Link>
              <NotificationBell initialUnread={unreadCount} />
              <Link
                href="/settings"
                className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                title="Cài đặt tài khoản"
              >
                {session.user.image ? (
                  <Image src={session.user.image} alt={session.user.name ?? ""} width={32} height={32} className="object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-primary">
                    {session.user.name?.charAt(0).toUpperCase() ?? <UserCircle2 className="h-4 w-4" />}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Đăng nhập</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Đăng ký</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background">
        {/* Apply dark class before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var p=JSON.parse(localStorage.getItem("reader-prefs")||"{}");if(p.theme&&p.theme!=="light")document.documentElement.classList.add("dark")}catch{}` }} />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <Toaster />
      </body>
    </html>
  )
}
