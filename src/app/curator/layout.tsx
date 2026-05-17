import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BookOpen, LayoutDashboard, LogOut } from "lucide-react"

export default async function CuratorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  if (session.user.role !== "CURATOR" && session.user.role !== "ADMIN") redirect("/")

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 flex flex-col p-4 gap-1">
        <div className="font-semibold text-sm mb-4 px-2">Curator CMS</div>
        <Link href="/curator" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>
        <Link href="/curator/novels" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <BookOpen className="h-4 w-4" /> Novels
        </Link>
        <div className="mt-auto">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-muted-foreground">
            <LogOut className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
