import { getAdminStats, listAuditLogs, getAnalytics } from "@/modules/admin"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import Link from "next/link"

export const metadata = { title: "Admin Dashboard" }

function StatCard({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${warn ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${warn ? "text-destructive" : ""}`}>{value}</p>
    </div>
  )
}

export default async function AdminDashboard() {
  const [stats, { items: logs }, analytics] = await Promise.all([
    getAdminStats(),
    listAuditLogs(),
    getAnalytics(),
  ])

  const revenueFormatted = stats.revenueVnd.toLocaleString("vi-VN") + " ₫"
  const maxRevenue = Math.max(...analytics.revenueByMonth.map((r) => r.total), 1)
  const maxUsers = Math.max(...analytics.newUsersByDay.map((d) => d.count), 1)

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Người dùng" value={stats.userCount} />
        <StatCard label="Truyện" value={stats.novelCount} />
        <StatCard label="Doanh thu" value={revenueFormatted} />
        <StatCard label="Báo cáo chờ" value={stats.pendingReports} warn={stats.pendingReports > 0} />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly revenue */}
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold text-sm mb-4">Doanh thu 6 tháng gần đây</h2>
          {analytics.revenueByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có doanh thu.</p>
          ) : (
            <div className="space-y-3">
              {analytics.revenueByMonth.map((r) => {
                const pct = Math.round((r.total / maxRevenue) * 100)
                return (
                  <div key={r.month} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-xs text-muted-foreground shrink-0">{r.month}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-28 text-right text-xs text-muted-foreground shrink-0">
                      {r.total.toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top novels */}
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold text-sm mb-4">Top 5 truyện xem nhiều nhất</h2>
          {analytics.topNovels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topNovels.map((n, i) => (
                <div key={n.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-xs text-muted-foreground shrink-0">{i + 1}.</span>
                  <Link href={`/novels/${n.slug}`} className="flex-1 truncate hover:text-primary transition-colors">
                    {n.title}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {Number(n.totalViews).toLocaleString()} lượt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New users per day */}
      <div className="border rounded-lg p-5 mb-8">
        <h2 className="font-semibold text-sm mb-4">Người dùng mới (14 ngày gần đây)</h2>
        {analytics.newUsersByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {analytics.newUsersByDay.map((d) => {
              const pct = Math.max(Math.round((d.count / maxUsers) * 100), 4)
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.day}: ${d.count} người`}>
                  <span className="text-[10px] text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
                  <div className="w-full bg-primary/70 rounded-t" style={{ height: `${pct}%` }} />
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.day}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <h2 className="text-base font-semibold mb-3">Hoạt động gần đây</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
      ) : (
        <div className="border rounded-lg divide-y text-sm">
          {logs.slice(0, 10).map((log) => (
            <div key={log.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="font-medium">{log.actorName}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                {log.targetType && (
                  <span className="ml-1 text-muted-foreground">{log.targetType}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: vi })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
