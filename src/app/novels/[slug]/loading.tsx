export default function NovelDetailLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-muted/30 animate-pulse">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-12">
          <div className="flex gap-6 md:gap-10">
            {/* Cover */}
            <div className="w-36 md:w-52 shrink-0 aspect-[2/3] rounded-lg bg-muted" />
            {/* Info */}
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="space-y-2">
                <div className="h-7 bg-muted rounded w-3/4" />
                <div className="h-7 bg-muted rounded w-1/2" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-muted rounded-full" />
                <div className="h-6 w-16 bg-muted rounded-full" />
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-32 bg-muted rounded" />
                <div className="h-9 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body skeleton */}
      <main className="max-w-4xl mx-auto px-4 pb-12 space-y-8 animate-pulse">
        {/* Synopsis */}
        <section className="space-y-2">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-4/5" />
        </section>
        {/* Chapter list */}
        <section>
          <div className="h-4 bg-muted rounded w-40 mb-3" />
          <div className="border-t" />
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex gap-3 items-center">
                  <div className="h-3 w-8 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
