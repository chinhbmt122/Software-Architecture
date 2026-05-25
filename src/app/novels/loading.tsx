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

export default function NovelsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-2 mb-6 animate-pulse">
        <div className="h-9 w-40 bg-muted rounded-lg" />
        <div className="h-9 w-28 bg-muted rounded-lg" />
        <div className="h-9 w-28 bg-muted rounded-lg" />
      </div>
      {/* Search skeleton */}
      <div className="h-10 bg-muted rounded-lg mb-6 animate-pulse" />
      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
          <NovelCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
