import { listUsers } from "@/modules/admin"
import { UserRoleSelect } from "./_components/user-role-select"
import { UserStatusActions } from "./_components/user-status-actions"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

export const metadata = { title: "Quản lý người dùng" }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>
}) {
  const sp = await searchParams
  const { items, nextCursor } = await listUsers(sp.q, sp.cursor)

  function href(params: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (sp.q) p.set("q", sp.q)
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    return `/admin/users?${p.toString()}`
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Người dùng</h1>

      <form method="GET" action="/admin/users" className="mb-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Tìm tên hoặc email…"
          className="w-72 px-3 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Tên</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Vai trò</th>
              <th className="text-left px-4 py-2.5 font-medium">Trạng thái</th>
              <th className="text-left px-4 py-2.5 font-medium">Tham gia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{user.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-2.5">
                  <UserRoleSelect userId={user.id} currentRole={user.role} />
                </td>
                <td className="px-4 py-2.5">
                  <UserStatusActions userId={user.id} currentStatus={user.status as "ACTIVE" | "SUSPENDED" | "BANNED"} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {formatDistanceToNow(user.createdAt, { addSuffix: true, locale: vi })}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-4 text-sm">
        {sp.cursor ? (
          <a href={href({ cursor: undefined })} className="text-primary hover:underline">← Trang đầu</a>
        ) : <span />}
        {nextCursor && (
          <a href={href({ cursor: nextCursor })} className="text-primary hover:underline">Tiếp theo →</a>
        )}
      </div>
    </div>
  )
}
