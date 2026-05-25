import { listGenres, listNovels } from "@/modules/content"
import { searchNovels } from "@/modules/search"
import { NovelCard } from "@/components/novel-card"
import Link from "next/link"
import Image from "next/image"
import { Search, Eye, Star, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchParams {
  status?: string
  genreId?: string
  q?: string
  sort?: string
  featured?: string
}

export const metadata = { title: "Thư viện truyện" }

const STATUS_FILTERS = [
  { label: "Tất cả", value: undefined },
  { label: "Đang ra", value: "ONGOING" },
  { label: "Hoàn thành", value: "COMPLETED" },
  { label: "Tạm dừng", value: "HIATUS" },
  { label: "Đã drop", value: "DROPPED" },
]

const RANK_SORT_TABS = [
  { label: "Lượt xem", value: "trending" },
  { label: "Đánh giá", value: "rating" },
  { label: "Số chương", value: "chapters" },
]

const RANKING_SORTS = new Set(["trending", "rating", "chapters"])

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default async function NovelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const isRanking = RANKING_SORTS.has(sp.sort ?? "")

  const [novels, genres] = await Promise.all([
    sp.q
      ? searchNovels(sp.q, { status: sp.status, genreId: sp.genreId ? Number(sp.genreId) : undefined, limit: 40 })
      : listNovels({
          status: sp.status,
          genreId: sp.genreId ? Number(sp.genreId) : undefined,
          isFeatured: sp.featured === "true" ? true : undefined,
          sort: sp.sort,
          limit: isRanking ? 50 : 40,
        }),
    listGenres(),
  ])

  function filterHref(key: string, value: string | undefined) {
    const params = new URLSearchParams(sp as Record<string, string>)
    if (value) params.set(key, value)
    else params.delete(key)
    return `/novels?${params.toString()}`
  }

  /* ── Rankings layout ──────────────────────────────────────── */
  if (isRanking) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-5">Bảng xếp hạng</h1>

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-7">
          {RANK_SORT_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/novels?sort=${tab.value}`}
              className={cn(
                "px-4 py-1.5 text-sm rounded-full border transition-colors",
                sp.sort === tab.value
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:border-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Ranked list */}
        <div className="flex flex-col gap-2">
          {novels.map((novel, i) => {
            const rank = i + 1
            const rankColor =
              rank === 1 ? "text-yellow-500 font-black" :
              rank === 2 ? "text-slate-400 font-black" :
              rank === 3 ? "text-amber-600 font-black" :
              "text-muted-foreground font-semibold"

            const stat =
              sp.sort === "rating"
                ? novel.avgRating
                  ? <><Star className="h-3 w-3" />{Number(novel.avgRating).toFixed(1)}</>
                  : <span className="text-muted-foreground">—</span>
                : sp.sort === "chapters"
                ? <><BookOpen className="h-3 w-3" />{novel.totalChapters} chương</>
                : <><Eye className="h-3 w-3" />{formatViews(novel.totalViews ?? 0)}</>

            return (
              <Link
                key={novel.id}
                href={`/novels/${novel.slug}`}
                className="flex items-center gap-4 p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                {/* Rank */}
                <span className={cn("w-7 text-center text-base shrink-0", rankColor)}>
                  {rank}
                </span>

                {/* Cover */}
                <div className="relative h-16 w-11 shrink-0 rounded overflow-hidden bg-muted">
                  {novel.coverImageUrl ? (
                    <Image
                      src={novel.coverImageUrl}
                      alt={novel.title}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {novel.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {novel.totalChapters} chương
                  </p>
                </div>

                {/* Stat */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  {stat}
                </div>
              </Link>
            )
          })}

          {novels.length === 0 && (
            <p className="text-muted-foreground text-center py-20 text-sm">
              Chưa có dữ liệu.
            </p>
          )}
        </div>
      </main>
    )
  }

  /* ── Library layout (unchanged) ──────────────────────────── */
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-5">Thư viện truyện</h1>

      {/* Search */}
      <form method="GET" action="/novels" className="relative mb-5">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        {sp.genreId && <input type="hidden" name="genreId" value={sp.genreId} />}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Tìm kiếm truyện..."
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STATUS_FILTERS.map(({ label, value }) => {
          const active = sp.status === value || (value === undefined && !sp.status)
          return (
            <Link
              key={label}
              href={filterHref("status", active ? undefined : value)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "px-3 py-1 text-sm rounded-full border transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:border-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Genre filter */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-7">
          {genres.map((g) => {
            const active = sp.genreId === String(g.id)
            return (
                <Link
                  key={g.id}
                  href={filterHref("genreId", active ? undefined : String(g.id))}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                  "px-3 py-1 text-sm rounded-full border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                )}
              >
                {g.name}
              </Link>
            )
          })}
        </div>
      )}

      {(sp.status || sp.genreId || sp.q) && (
        <div className="mb-7">
          <Link href="/novels" className="text-sm text-muted-foreground hover:text-foreground">
            Xóa lọc
          </Link>
        </div>
      )}

      {/* Results */}
      {novels.length === 0 ? (
        <p className="text-muted-foreground text-center py-20 text-sm">
          Không tìm thấy truyện nào.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">{novels.length} truyện</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {novels.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
