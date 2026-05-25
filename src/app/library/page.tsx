import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { listFollowedNovels } from "@/modules/reader"
import Link from "next/link"
import Image from "next/image"
import { BookOpen } from "lucide-react"

export const metadata = { title: "Tủ sách" }

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in?callbackUrl=/library")

  const followed = await listFollowedNovels(session.user.id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Tủ sách của tôi</h1>

      {followed.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 opacity-30" />
          <p>Bạn chưa theo dõi truyện nào.</p>
          <Link href="/novels" className="underline text-sm hover:text-foreground transition-colors">
            Khám phá truyện
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {followed.map((novel) => (
            <Link
              key={novel.id}
              href={`/novels/${novel.slug}`}
              className="group flex gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              {novel.coverUrl ? (
                <Image
                  src={novel.coverUrl}
                  alt={novel.title}
                  width={56}
                  height={80}
                  className="rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-20 rounded bg-muted shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm line-clamp-2 group-hover:text-foreground">{novel.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{novel.totalChapters} chương</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
