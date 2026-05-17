import { getNovelBySlug, listChaptersByNovel, incrementNovelViews, getRecommendedNovels } from "@/modules/content"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BookOpen, Star, Eye, Lock, ChevronRight, BookMarked } from "lucide-react"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { readingProgress, chapters } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { NovelReviews } from "./_components/novel-reviews"
import { FollowButton } from "./_components/follow-button"
import { NovelCard } from "@/components/novel-card"

interface Props {
  params: Promise<{ slug: string }>
}

const LANG_LABEL: Record<string, string> = { ZH: "Trung", KO: "Hàn", JA: "Nhật", EN: "Anh", VI: "Việt" }
const STATUS_LABEL: Record<string, string> = {
  ONGOING: "Đang ra",
  COMPLETED: "Hoàn thành",
  HIATUS: "Tạm dừng",
  DROPPED: "Đã drop",
}
const STATUS_COLOR: Record<string, string> = {
  ONGOING:   "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  COMPLETED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  HIATUS:    "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  DROPPED:   "bg-red-500/15 text-red-400 border-red-500/30",
}

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const novel = await getNovelBySlug(slug)
  if (!novel) return {}
  return {
    title: novel.title,
    description: novel.synopsis ?? undefined,
    openGraph: {
      title: novel.title,
      description: novel.synopsis ?? undefined,
      images: novel.coverImageUrl ? [{ url: novel.coverImageUrl }] : [],
      type: "book",
    },
    twitter: { card: "summary_large_image", title: novel.title, description: novel.synopsis ?? undefined },
    alternates: { canonical: `/novels/${slug}` },
  }
}

export default async function NovelDetailPage({ params }: Props) {
  const { slug } = await params
  const novel = await getNovelBySlug(slug)
  if (!novel) notFound()

  const session = await auth.api.getSession({ headers: await headers() })

  const [chapterList, progressRow, recommended] = await Promise.all([
    listChaptersByNovel(novel.id),
    session
      ? db
          .select({ chapterNumber: chapters.chapterNumber })
          .from(readingProgress)
          .innerJoin(chapters, eq(readingProgress.chapterId, chapters.id))
          .where(and(eq(readingProgress.userId, session.user.id), eq(readingProgress.novelId, novel.id)))
          .orderBy(desc(readingProgress.updatedAt))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    getRecommendedNovels(novel.id, novel.genres.map((g) => g.id)),
  ])
  incrementNovelViews(novel.id)

  const chaptersList = chapterList
  const firstChapter = chaptersList[0]
  const continueChapterNumber = progressRow?.chapterNumber ?? null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: novel.title,
    description: novel.synopsis,
    image: novel.coverImageUrl,
    inLanguage: "vi",
    numberOfPages: novel.totalChapters,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero with blurred backdrop ─────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Blurred cover as background */}
        {novel.coverImageUrl && (
          <div className="absolute inset-0 scale-110">
            <Image
              src={novel.coverImageUrl}
              alt=""
              fill
              className="object-cover blur-2xl opacity-30 dark:opacity-20"
              sizes="100vw"
              priority
            />
          </div>
        )}
        {/* Gradient fade to background at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <div className="relative max-w-4xl mx-auto px-4 pt-10 pb-12">
          <div className="flex gap-6 md:gap-10">
            {/* Cover */}
            <div className="relative w-36 md:w-52 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 bg-muted">
              {novel.coverImageUrl ? (
                <Image src={novel.coverImageUrl} alt={novel.title} fill className="object-cover" sizes="208px" priority />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <BookOpen className="h-16 w-16" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3">{novel.title}</h1>

                {/* Status + language + genres */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[novel.status] ?? ""}`}>
                    {STATUS_LABEL[novel.status] ?? novel.status}
                  </span>
                  <Badge variant="outline" className="text-xs">{LANG_LABEL[novel.originalLanguage] ?? novel.originalLanguage}</Badge>
                  {novel.genres.map((g) => (
                    <Badge key={g.id} variant="outline" className="text-xs">{g.name}</Badge>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {novel.totalChapters} chương
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {Number(novel.totalViews).toLocaleString()} lượt xem
                </span>
                {novel.avgRating && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {Number(novel.avgRating).toFixed(1)}
                  </span>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-2">
                {firstChapter ? (
                  continueChapterNumber ? (
                    <>
                      <Button asChild size="sm">
                        <Link href={`/novels/${slug}/chapters/${continueChapterNumber}`}>
                          <BookMarked className="h-4 w-4 mr-1" />
                          Tiếp tục đọc
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="bg-background/50 backdrop-blur-sm">
                        <Link href={`/novels/${slug}/chapters/${firstChapter.chapterNumber}`}>
                          Từ đầu
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild size="sm">
                      <Link href={`/novels/${slug}/chapters/${firstChapter.chapterNumber}`}>
                        Đọc từ đầu <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button size="sm" disabled>Chưa có chương</Button>
                )}
                <FollowButton novelId={novel.id} isLoggedIn={!!session} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 pb-12 space-y-8">

        {/* Synopsis */}
        {novel.synopsis && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Giới thiệu
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{novel.synopsis}</p>
          </section>
        )}

        {/* Tags */}
        {novel.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {novel.tags.map((tag) => (
              <Link key={tag.id} href={`/novels?tag=${tag.slug}`}>
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                  #{tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Reviews */}
        <NovelReviews novelId={novel.id} userId={session?.user.id} />

        {/* Chapter list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">
              Danh sách chương{" "}
              <span className="text-muted-foreground font-normal">({chaptersList.length})</span>
            </h2>
          </div>
          <Separator className="mb-1" />

          {chaptersList.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Chưa có chương nào.</p>
          ) : (
            <div className="divide-y">
              {chaptersList.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/novels/${slug}/chapters/${ch.chapterNumber}`}
                  className="flex items-center justify-between py-3 hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground shrink-0 w-10 font-mono">
                      {ch.chapterNumber}
                    </span>
                    <span className="text-sm truncate">{ch.title}</span>
                    {ch.isVip && <Lock className="h-3 w-3 text-amber-500 shrink-0" />}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-4">
                    {formatDate(ch.publishedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recommendations */}
        {recommended.length > 0 && (
          <section>
            <h2 className="font-semibold text-sm mb-3">Có thể bạn thích</h2>
            <Separator className="mb-4" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {recommended.map((n) => (
                <NovelCard key={n.id} novel={n} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
