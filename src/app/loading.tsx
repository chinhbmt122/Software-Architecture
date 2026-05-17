function NovelCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] w-full rounded bg-muted" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  )
}

function SectionSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-muted rounded w-32 animate-pulse" />
      </div>
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-${cols} gap-3`}>
        {Array.from({ length: cols * 2 }).map((_, i) => (
          <NovelCardSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

export default function HomeLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <SectionSkeleton cols={6} />
      <SectionSkeleton cols={5} />
      <SectionSkeleton cols={5} />
    </main>
  )
}
