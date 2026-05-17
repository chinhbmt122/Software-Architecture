import { listAuditLogs } from "@/modules/admin"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import Link from "next/link"

export const metadata = { title: "Nhật ký hoạt động" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const sp = await searchParams
  const { items, nextCursor } = await listAuditLogs(sp.cursor)

  function pageHref(cursor: string | null) {
    const p = new URLSearchParams()
    if (cursor) p.set("cursor", cursor)
    return `/admin/audit?${p.toString()}`
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Nhật ký hoạt động</h1>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chưa có hoạt động nào.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Admin</th>
                <th className="text-left px-4 py-2.5 font-medium">Hành động</th>
                <th className="text-left px-4 py-2.5 font-medium">Loại mục tiêu</th>
                <th className="text-left px-4 py-2.5 font-medium">Chi tiết</th>
                <th className="text-left px-4 py-2.5 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 align-top">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{log.actorName}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{log.targetType}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[280px]">
                    {log.metadata && typeof log.metadata === "object" ? (
                      <pre className="font-mono text-[11px] bg-muted px-2 py-1 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 0)}
                      </pre>
                    ) : log.targetId ? (
                      <span className="font-mono">{log.targetId.slice(0, 12)}…</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {format(log.createdAt, "dd/MM/yyyy HH:mm", { locale: vi })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between mt-4 text-sm">
        {sp.cursor ? (
          <Link href="/admin/audit" className="text-primary hover:underline">← Trang đầu</Link>
        ) : <span />}
        {nextCursor && (
          <a href={pageHref(nextCursor)} className="text-primary hover:underline">Tiếp theo →</a>
        )}
      </div>
    </div>
  )
}
