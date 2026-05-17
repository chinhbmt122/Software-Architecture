import { listGenres, listNovels } from "@/modules/content"
import { searchNovels } from "@/modules/search"
import { NovelCard } from "@/components/novel-card"
import Link from "next/link"
import { Search } from "lucide-react"
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

export default async function NovelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const [novels, genres] = await Promise.all([
    sp.q
      ? searchNovels(sp.q, { status: sp.status, limit: 40 })
      : listNovels({
          status: sp.status,
          genreId: sp.genreId ? Number(sp.genreId) : undefined,
          isFeatured: sp.featured === "true" ? true : undefined,
          limit: 40,
        }),
    listGenres(),
  ])

  function filterHref(key: string, value: string | undefined) {
    const params = new URLSearchParams(sp as Record<string, string>)
    if (value) params.set(key, value)
    else params.delete(key)
    return `/novels?${params.toString()}`
  }

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
              href={filterHref("status", value)}
              className={cn(
                "px-3 py-1 text-sm rounded-full border transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
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
                className={cn(
                  "px-3 py-1 text-sm rounded-full border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                )}
              >
                {g.name}
              </Link>
            )
          })}
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
