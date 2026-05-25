"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, List, Lock, LockOpen } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ReaderSettingsButton, useReaderPrefs } from "./reader-settings"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ChapterLockGate } from "./chapter-lock-gate"
import { ChapterComments } from "./chapter-comments"

interface Chapter {
  id: string
  chapterNumber: number
  title: string
  content: string
  wordCount: number
  isVip: boolean
}

interface Adjacent {
  prev: { chapterNumber: number; title: string } | null
  next: { chapterNumber: number; title: string } | null
}

interface AllChapter {
  chapterNumber: number
  title: string
  isVip: boolean
  isUnlocked: boolean
}

interface Props {
  novel: { id: string; title: string; slug: string }
  chapter: Chapter
  adjacent: Adjacent
  allChapters: AllChapter[]
  userId?: string
  readingTimeMin: number
  isLocked?: boolean
  coinBalance?: number
  coinCost?: number
}

const THEME_STYLES: Record<string, { container: string; bar: string; text: string; prose: string }> = {
  light: {
    container: "bg-[#faf9f6] text-[#1a1a1a]",
    bar:       "bg-[#faf9f6] border-[#e5e3e0]",
    text:      "text-[#9a9590]",
    prose:     "text-[#1a1a1a]",
  },
  dark: {
    container: "bg-[#212121] text-[#ececec]",
    bar:       "bg-[#212121] border-[#333333]",
    text:      "text-[#6b6b6b]",
    prose:     "text-[#ececec]",
  },
  night: {
    container: "bg-[#0f0f0f] text-[#e5e5e5]",
    bar:       "bg-[#0f0f0f] border-[#222222]",
    text:      "text-[#555555]",
    prose:     "text-[#e5e5e5]",
  },
}

export function ChapterReader({ novel, chapter, adjacent, allChapters, userId, readingTimeMin, isLocked = false, coinBalance = 0, coinCost = 1 }: Props) {
  const { prefs, update } = useReaderPrefs()
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const theme = THEME_STYLES[prefs.theme] ?? THEME_STYLES.light
  const chapterUrl = (n: number) => `/novels/${novel.slug}/chapters/${n}`
  const totalChapters = allChapters.length

  // Sync reader theme → <html> so the sticky site header respects it too
  // View counting: fire after 55% of estimated reading time
  useEffect(() => {
    const viewKey = `viewed:${chapter.id}`
    if (sessionStorage.getItem(viewKey)) return

    const thresholdMs = Math.max(readingTimeMin * 60 * 1000 * 0.55, 10_000)

    viewTimer.current = setTimeout(() => {
      sessionStorage.setItem(viewKey, "1")
      fetch(`/api/novels/${novel.id}/chapters/${chapter.id}/view`, { method: "POST" })
    }, thresholdMs)

    return () => { if (viewTimer.current) clearTimeout(viewTimer.current) }
  }, [chapter.id, novel.id, readingTimeMin])

  // Reading progress save (debounced)
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${chapter.id}`)
    if (saved) window.scrollTo({ top: Number(saved) })

    function handleScroll() {
      sessionStorage.setItem(`scroll:${chapter.id}`, String(window.scrollY))
      if (!userId) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novelId: novel.id,
            chapterId: chapter.id,
            scrollPosition: window.scrollY,
          }),
        })
      }, 2000)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [chapter.id, novel.id, userId])

  return (
    <div className={cn("min-h-screen transition-colors duration-200", theme.container)}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className={cn("sticky top-14 z-40 h-11 flex items-center px-4 border-b", theme.bar)}>
        {/* Back to novel */}
        <Link
          href={`/novels/${novel.slug}`}
          className={cn("flex items-center gap-1 text-sm shrink-0 hover:opacity-80 transition-opacity", theme.text)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:block max-w-[160px] truncate">{novel.title}</span>
        </Link>

        {/* Chapter indicator */}
        <span className={cn("flex-1 text-center text-xs truncate px-4", theme.text)}>
          Chương {chapter.chapterNumber} / {totalChapters}
        </span>

        {/* ToC + Settings */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Sheet>
            <SheetTrigger asChild>
              <button className={cn("p-2 rounded-md hover:bg-black/5 transition-colors", theme.text)}>
                <List className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-sm">Mục lục</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-full pb-8">
                <div className="p-2">
                  {allChapters.map((ch) => (
                    <Link
                      key={ch.chapterNumber}
                      href={chapterUrl(ch.chapterNumber)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-muted transition-colors",
                        ch.chapterNumber === chapter.chapterNumber && "bg-muted font-medium"
                      )}
                    >
                      <span className="text-xs text-muted-foreground w-8 shrink-0">
                        {ch.chapterNumber}
                      </span>
                      <span className="truncate flex-1">{ch.title}</span>
                      {ch.isVip && (
                        ch.isUnlocked
                          ? <LockOpen className="h-3 w-3 text-emerald-500 shrink-0" />
                          : <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <ReaderSettingsButton prefs={prefs} onUpdate={update} />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {isLocked ? (
        <ChapterLockGate
          novelId={novel.id}
          chapterId={chapter.id}
          coinCost={coinCost}
          coinBalance={coinBalance}
          isLoggedIn={!!userId}
          theme={theme}
        />
      ) : (
        <article
          className="chapter-content mx-auto px-5 pt-10 pb-28"
          style={{
            maxWidth: prefs.width,
            fontSize: prefs.fontSize,
            lineHeight: prefs.lineHeight,
            fontFamily: prefs.fontFamily === "serif"
              ? "var(--font-lora), Georgia, 'Times New Roman', serif"
              : "var(--font-sans), system-ui, sans-serif",
          }}
        >
          {/* Chapter header */}
          <div className="text-center mb-12">
            <p className={cn("text-xs mb-2 font-[family-name:var(--font-sans)]", theme.text)}>
              Chương {chapter.chapterNumber}
              {chapter.isVip && (
                <span className={`ml-2 inline-flex items-center gap-0.5 ${isLocked ? "text-amber-500" : "text-emerald-500"}`}>
                  {isLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />} VIP
                </span>
              )}
            </p>
            <h1 className="text-xl font-bold leading-snug">{chapter.title}</h1>
            <div className={cn("flex items-center justify-center gap-2 mt-3 text-xs font-[family-name:var(--font-sans)]", theme.text)}>
              <span>{readingTimeMin} phút đọc</span>
              <span>·</span>
              <span>{chapter.wordCount.toLocaleString()} chữ</span>
            </div>
            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <div className={cn("h-px w-16", theme.text, "opacity-30 bg-current")} />
              <span className={cn("text-base", theme.text)}>❧</span>
              <div className={cn("h-px w-16", theme.text, "opacity-30 bg-current")} />
            </div>
          </div>

          {/* Body — split on double newlines into real paragraphs */}
          <div className={cn("space-y-[1.3em]", theme.prose)}>
            {chapter.content.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">{para.trim()}</p>
            ))}
          </div>
        </article>
      )}

      {/* ── Comments (only when content is visible) ───────── */}
      {!isLocked && (
        <ChapterComments
          novelId={novel.id}
          chapterId={chapter.id}
          userId={userId}
          theme={theme}
        />
      )}

      {/* ── Bottom nav bar (fixed) ───────────────────────────── */}
      <div className={cn("fixed bottom-0 inset-x-0 z-40 border-t h-14", theme.bar)}>
        <div className="max-w-2xl mx-auto h-full flex items-center justify-between px-6">
          {adjacent.prev ? (
            <Link
              href={chapterUrl(adjacent.prev.chapterNumber)}
              className={cn("flex items-center gap-1 text-sm hover:opacity-80 transition-opacity", theme.text)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Chương trước</span>
            </Link>
          ) : (
            <span />
          )}

          <span className={cn("text-xs", theme.text)}>
            {chapter.chapterNumber} / {totalChapters}
          </span>

          {adjacent.next ? (
            <Link
              href={chapterUrl(adjacent.next.chapterNumber)}
              className={cn("flex items-center gap-1 text-sm hover:opacity-80 transition-opacity", theme.text)}
            >
              <span className="hidden sm:inline">Chương tiếp</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn("text-xs", theme.text)}>Hết truyện</span>
          )}
        </div>
      </div>

    </div>
  )
}
