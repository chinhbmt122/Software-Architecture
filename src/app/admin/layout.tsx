import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Users, ShieldAlert, ScrollText, LogOut } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  if (session.user.role !== "ADMIN") redirect("/")

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 flex flex-col p-4 gap-1 shrink-0">
        <div className="font-semibold text-sm mb-4 px-2">Admin Panel</div>
        <Link href="/admin" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>
        <Link href="/admin/users" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <Users className="h-4 w-4" /> Người dùng
        </Link>
        <Link href="/admin/moderation" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <ShieldAlert className="h-4 w-4" /> Kiểm duyệt
        </Link>
        <Link href="/admin/audit" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm">
          <ScrollText className="h-4 w-4" /> Nhật ký
        </Link>
        <div className="mt-auto">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-muted-foreground">
            <LogOut className="h-4 w-4" /> Về trang chủ
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
