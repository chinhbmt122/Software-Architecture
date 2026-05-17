"use client"

import Link from "next/link"
import Image from "next/image"
import { BookOpen } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  ONGOING: "Đang ra",
  COMPLETED: "Hoàn thành",
  HIATUS: "Tạm dừng",
  DROPPED: "Đã drop",
}

interface Novel {
  id: string
  title: string
  slug: string
  coverImageUrl: string | null
  status: string
  totalChapters: number
  avgRating?: string | null
  totalViews?: number
}

export function NovelCard({ novel }: { novel: Novel }) {
  const statusLabel = STATUS_LABEL[novel.status] ?? novel.status

  return (
    <Link href={`/novels/${novel.slug}`} className="group block">
      {/* Cover */}
      <div className="relative aspect-[2/3] w-full rounded overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow duration-200">
        {novel.coverImageUrl ? (
          <Image
            src={novel.coverImageUrl}
            alt={novel.title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 180px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <BookOpen className="h-10 w-10" />
          </div>
        )}

        {/* Bottom gradient + status badge */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-sm text-white bg-black/40 backdrop-blur-sm">
          {statusLabel}
        </span>
      </div>

      {/* Metadata */}
      <div className="mt-2 space-y-0.5">
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {novel.title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {novel.totalChapters} chương
        </p>
      </div>
    </Link>
  )
}
