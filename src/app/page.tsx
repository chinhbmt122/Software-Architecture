import { getFeaturedNovels, getNewArrivals, getTrendingNovels } from "@/modules/content"
import { NovelCard } from "@/components/novel-card"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, BookOpen } from "lucide-react"
import { logger } from "@/lib/logger"

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full bg-primary" />
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
      </div>
      <Link
        href={href}
        className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        Xem thêm <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function EmptySection() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Chưa có nội dung.
    </div>
  )
}

export default async function HomePage() {
  let trending: Awaited<ReturnType<typeof getTrendingNovels>> = []
  let newArrivals: Awaited<ReturnType<typeof getNewArrivals>> = []
  let featured: Awaited<ReturnType<typeof getFeaturedNovels>> = []

  try {
    ;[trending, newArrivals, featured] = await Promise.all([
      getTrendingNovels(10),
      getNewArrivals(10),
      getFeaturedNovels(6),
    ])
  } catch (err) {
    logger.error({ err }, "HomePage: failed to load novels")
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">

      {/* Featured banner — show only if there are featured novels */}
      {featured.length > 0 && (
        <section>
          <SectionHeader title="Đặc sắc" href="/novels?featured=true" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {featured.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      <section>
        <SectionHeader title="Thịnh hành" href="/novels?sort=trending" />
        {trending.length === 0 ? (
          <EmptySection />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {trending.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        )}
      </section>

      {/* New arrivals */}
      <section>
        <SectionHeader title="Mới cập nhật" href="/novels?sort=new" />
        {newArrivals.length === 0 ? (
          <EmptySection />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {newArrivals.map((novel) => (
              <NovelCard key={novel.id} novel={novel} />
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
