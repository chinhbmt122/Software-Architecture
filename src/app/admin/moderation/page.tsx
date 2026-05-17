import { listPendingReports, listHiddenComments, listHiddenReviews } from "@/modules/admin"
import { ReportActions } from "./_components/report-actions"
import { ContentHideButton } from "./_components/content-hide-button"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import Link from "next/link"
import { cn } from "@/lib/utils"

export const metadata = { title: "Kiểm duyệt" }

const TABS = [
  { key: "reports", label: "Báo cáo chờ" },
  { key: "comments", label: "Bình luận đã ẩn" },
  { key: "reviews", label: "Đánh giá đã ẩn" },
]

const TARGET_LABEL: Record<string, string> = {
  COMMENT: "Bình luận",
  REVIEW: "Đánh giá",
  CHAPTER: "Chương",
  USER: "Người dùng",
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab ?? "reports"

  const [reports, hiddenComments, hiddenReviews] = await Promise.all([
    tab === "reports" ? listPendingReports(sp.cursor) : Promise.resolve({ items: [], nextCursor: null }),
    tab === "comments" ? listHiddenComments(sp.cursor) : Promise.resolve({ items: [], nextCursor: null }),
    tab === "reviews" ? listHiddenReviews(sp.cursor) : Promise.resolve({ items: [], nextCursor: null }),
  ])

  function tabHref(key: string) {
    return `/admin/moderation?tab=${key}`
  }

  function pageHref(cursor: string | null) {
    const p = new URLSearchParams({ tab })
    if (cursor) p.set("cursor", cursor)
    return `/admin/moderation?${p.toString()}`
  }

  const { items: reportItems, nextCursor: reportNext } = reports
  const { items: commentItems, nextCursor: commentNext } = hiddenComments
  const { items: reviewItems, nextCursor: reviewNext } = hiddenReviews

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Kiểm duyệt</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={cn(
              "px-4 py-2 text-sm -mb-px border-b-2 transition-colors",
              tab === key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Reports */}
      {tab === "reports" && (
        <>
          {reportItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Không có báo cáo nào chờ xử lý.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Người báo cáo</th>
                    <th className="text-left px-4 py-2.5 font-medium">Loại</th>
                    <th className="text-left px-4 py-2.5 font-medium">Lý do</th>
                    <th className="text-left px-4 py-2.5 font-medium">Nội dung</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thời gian</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportItems.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.reporterName}</div>
                        <div className="text-xs text-muted-foreground">{r.reporterEmail}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="bg-muted px-1.5 py-0.5 rounded">{TARGET_LABEL[r.targetType] ?? r.targetType}</span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px] text-muted-foreground">{r.reason}</td>
                      <td className="px-4 py-2.5 max-w-[200px] text-muted-foreground text-xs line-clamp-2">
                        {r.snippet ?? <span className="italic">ID: {r.targetId.slice(0, 8)}…</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(r.createdAt, { addSuffix: true, locale: vi })}
                      </td>
                      <td className="px-4 py-2.5">
                        <ReportActions reportId={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reportNext && (
            <div className="mt-4 text-sm">
              <a href={pageHref(reportNext)} className="text-primary hover:underline">Tải thêm →</a>
            </div>
          )}
        </>
      )}

      {/* Hidden comments */}
      {tab === "comments" && (
        <>
          {commentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Không có bình luận nào đang ẩn.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Tác giả</th>
                    <th className="text-left px-4 py-2.5 font-medium">Nội dung</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thời gian</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commentItems.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{c.authorName}</td>
                      <td className="px-4 py-2.5 max-w-[400px] text-muted-foreground text-xs line-clamp-2">{c.content}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(c.createdAt, { addSuffix: true, locale: vi })}
                      </td>
                      <td className="px-4 py-2.5">
                        <ContentHideButton id={c.id} type="comments" hidden={true} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {commentNext && (
            <div className="mt-4 text-sm">
              <a href={pageHref(commentNext)} className="text-primary hover:underline">Tải thêm →</a>
            </div>
          )}
        </>
      )}

      {/* Hidden reviews */}
      {tab === "reviews" && (
        <>
          {reviewItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Không có đánh giá nào đang ẩn.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Tác giả</th>
                    <th className="text-left px-4 py-2.5 font-medium">Đánh giá</th>
                    <th className="text-left px-4 py-2.5 font-medium">Nội dung</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thời gian</th>
                    <th className="text-left px-4 py-2.5 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reviewItems.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.authorName}</td>
                      <td className="px-4 py-2.5 text-amber-500 font-medium">{"★".repeat(r.rating)}</td>
                      <td className="px-4 py-2.5 max-w-[350px] text-muted-foreground text-xs line-clamp-2">{r.body ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(r.createdAt, { addSuffix: true, locale: vi })}
                      </td>
                      <td className="px-4 py-2.5">
                        <ContentHideButton id={r.id} type="reviews" hidden={true} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reviewNext && (
            <div className="mt-4 text-sm">
              <a href={pageHref(reviewNext)} className="text-primary hover:underline">Tải thêm →</a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
