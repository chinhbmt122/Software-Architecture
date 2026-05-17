"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { Star, ThumbsUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Author { id: string; name: string; image: string | null }
interface Review {
  id: string
  rating: number
  body: string | null
  createdAt: string
  helpfulCount: number
  author: Author
  myVote: boolean
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className="text-amber-400 transition-transform hover:scale-110"
        >
          <Star className={cn("h-4 w-4", (hover || value) >= i ? "fill-amber-400" : "fill-none")} />
        </button>
      ))}
    </div>
  )
}

interface Props {
  novelId: string
  userId?: string
}

export function NovelReviews({ novelId, userId }: Props) {
  const [items, setItems] = useState<Review[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [myReview, setMyReview] = useState<{ id: string; rating: number; body: string | null } | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [draftRating, setDraftRating] = useState(0)
  const [draftBody, setDraftBody] = useState("")
  const [saving, setSaving] = useState(false)

  async function load(cursor?: string) {
    setLoading(true)
    const url = `/api/novels/${novelId}/reviews${cursor ? `?cursor=${cursor}` : ""}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setItems((prev) => cursor ? [...prev, ...data.items] : data.items)
      setNextCursor(data.nextCursor)
      if (!cursor && data.myReview) {
        setMyReview(data.myReview)
        setDraftRating(data.myReview.rating)
        setDraftBody(data.myReview.body ?? "")
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [novelId])

  async function save() {
    if (!draftRating) { toast.error("Hãy chọn số sao"); return }
    setSaving(true)
    const res = await fetch(`/api/novels/${novelId}/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: draftRating, body: draftBody || null }),
    })
    setSaving(false)
    if (res.ok) {
      const rev = await res.json()
      setMyReview({ id: rev.id, rating: rev.rating, body: rev.body })
      setItems((prev) => {
        const idx = prev.findIndex((r) => r.author.id === userId)
        if (idx >= 0) return prev.map((r, i) => i === idx ? rev : r)
        return [rev, ...prev]
      })
      setEditMode(false)
      toast.success("Đã lưu đánh giá")
    } else {
      toast.error("Lưu thất bại")
    }
  }

  async function remove() {
    if (!myReview) return
    const res = await fetch(`/api/reviews/${myReview.id}`, { method: "DELETE" })
    if (res.ok) {
      setMyReview(null); setDraftRating(0); setDraftBody(""); setEditMode(false)
      setItems((prev) => prev.filter((r) => r.author.id !== userId))
      toast.success("Đã xóa đánh giá")
    }
  }

  async function helpful(reviewId: string) {
    if (!userId) { toast.error("Đăng nhập để vote"); return }
    const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" })
    if (res.ok) {
      const { helpful: isHelpful } = await res.json()
      setItems((prev) => prev.map((r) => r.id === reviewId
        ? { ...r, helpfulCount: r.helpfulCount + (isHelpful ? 1 : -1), myVote: isHelpful }
        : r
      ))
    }
  }

  const avgRating = items.length ? (items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1) : null

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          Đánh giá
          {avgRating && (
            <span className="flex items-center gap-1 text-amber-500 font-normal">
              <Star className="h-3.5 w-3.5 fill-amber-500" />
              {avgRating} · {items.length} đánh giá
            </span>
          )}
        </h2>
        {userId && !editMode && (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
            {myReview ? "Sửa đánh giá" : "Viết đánh giá"}
          </Button>
        )}
      </div>

      {editMode && (
        <div className="rounded-xl border p-5 mb-6 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Điểm ({draftRating}/10)</p>
            <StarRating value={draftRating} onChange={setDraftRating} />
          </div>
          <Textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Chia sẻ cảm nhận của bạn... (tuỳ chọn)"
            className="min-h-[100px] text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Hủy</Button>
            {myReview && <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={remove}>Xóa</Button>}
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Chưa có đánh giá nào.</p>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.author.name}</span>
                  <StarRating value={r.rating} />
                  <span className="text-xs text-muted-foreground">{r.rating}/10</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: vi })}
                </span>
              </div>
              {r.body && <p className="text-sm text-foreground/80 leading-relaxed">{r.body}</p>}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => helpful(r.id)}
                  className={cn("flex items-center gap-1 text-xs transition-colors hover:text-primary", r.myVote ? "text-primary" : "text-muted-foreground")}
                >
                  <ThumbsUp className={cn("h-3 w-3", r.myVote && "fill-primary")} />
                  Hữu ích {r.helpfulCount > 0 && `(${r.helpfulCount})`}
                </button>
                {r.author.id === userId && (
                  <button onClick={() => { setDraftRating(r.rating); setDraftBody(r.body ?? ""); setEditMode(true) }} className="text-xs text-muted-foreground hover:text-primary ml-auto">
                    Sửa
                  </button>
                )}
              </div>
            </div>
          ))}
          {nextCursor && (
            <Button variant="ghost" size="sm" onClick={() => load(nextCursor)} className="w-full">
              Xem thêm
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
