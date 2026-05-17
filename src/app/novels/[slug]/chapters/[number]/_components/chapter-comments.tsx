"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { ChevronDown, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Author { id: string; name: string; image: string | null }
interface Comment {
  id: string
  content: string
  createdAt: string
  upvoteCount: number
  downvoteCount: number
  isPinned: boolean
  parentId: string | null
  author: Author
  myVote: "UP" | "DOWN" | null
  replies?: Comment[]
}

interface Props {
  novelId: string
  chapterId: string
  userId?: string
  theme: { container: string; bar: string; text: string; prose: string }
}

function CommentItem({ comment, novelId, chapterId, userId, onDelete, theme }: {
  comment: Comment
  novelId: string
  chapterId: string
  userId?: string
  onDelete: (id: string) => void
  theme: Props["theme"]
}) {
  const [myVote, setMyVote] = useState(comment.myVote)
  const [ups, setUps] = useState(comment.upvoteCount)
  const [downs, setDowns] = useState(comment.downvoteCount)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replies, setReplies] = useState(comment.replies ?? [])
  const [sending, setSending] = useState(false)

  async function vote(type: "UP" | "DOWN") {
    if (!userId) { toast.error("Đăng nhập để vote"); return }
    const prev = myVote
    const wasUp = myVote === "UP", wasDn = myVote === "DOWN"
    if (type === "UP") {
      setMyVote(myVote === "UP" ? null : "UP")
      setUps((v) => v + (myVote === "UP" ? -1 : 1))
      if (wasDn) setDowns((v) => v - 1)
    } else {
      setMyVote(myVote === "DOWN" ? null : "DOWN")
      setDowns((v) => v + (myVote === "DOWN" ? -1 : 1))
      if (wasUp) setUps((v) => v - 1)
    }
    const res = await fetch(`/api/comments/${comment.id}/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteType: type }),
    })
    if (!res.ok) { setMyVote(prev); setUps(comment.upvoteCount); setDowns(comment.downvoteCount) }
  }

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true)
    const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: replyText.trim(), parentId: comment.id }),
    })
    setSending(false)
    if (res.ok) {
      const newReply = await res.json()
      setReplies((r) => [...r, newReply])
      setReplyText(""); setReplying(false)
    } else {
      toast.error("Gửi thất bại")
    }
  }

  return (
    <div className="group">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
          {comment.author.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{comment.author.name}</span>
            <span className={cn("text-xs", theme.text)}>
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: vi })}
            </span>
          </div>
          <p className={cn("text-sm leading-relaxed", theme.prose)}>{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => vote("UP")} className={cn("flex items-center gap-1 text-xs transition-colors hover:text-primary", myVote === "UP" ? "text-primary" : theme.text)}>
              <ThumbsUp className="h-3 w-3" /> {ups > 0 && ups}
            </button>
            <button onClick={() => vote("DOWN")} className={cn("flex items-center gap-1 text-xs transition-colors hover:text-primary", myVote === "DOWN" ? "text-primary" : theme.text)}>
              <ThumbsDown className="h-3 w-3" /> {downs > 0 && downs}
            </button>
            {userId && (
              <button onClick={() => setReplying(!replying)} className={cn("text-xs hover:text-primary transition-colors", theme.text)}>
                Trả lời
              </button>
            )}
            {userId === comment.author.id && (
              <button onClick={() => onDelete(comment.id)} className={cn("text-xs opacity-0 group-hover:opacity-100 hover:text-destructive transition-all", theme.text)}>
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-3 flex gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Viết trả lời..."
                className="text-sm min-h-[60px]"
              />
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={sendReply} disabled={sending}>Gửi</Button>
                <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Hủy</Button>
              </div>
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l border-border">
              {replies.map((r) => (
                <CommentItem key={r.id} comment={r} novelId={novelId} chapterId={chapterId} userId={userId} onDelete={onDelete} theme={theme} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ChapterComments({ novelId, chapterId, userId, theme }: Props) {
  const [items, setItems] = useState<Comment[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  async function load(cursor?: string) {
    setLoading(true)
    const url = `/api/novels/${novelId}/chapters/${chapterId}/comments${cursor ? `?cursor=${cursor}` : ""}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setItems((prev) => cursor ? [...prev, ...data.items] : data.items)
      setNextCursor(data.nextCursor)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [chapterId])

  async function submit() {
    if (!text.trim()) return
    setSending(true)
    const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    })
    setSending(false)
    if (res.ok) {
      const c = await res.json()
      setItems((prev) => [c, ...prev])
      setText("")
    } else {
      toast.error("Gửi thất bại")
    }
  }

  function handleDelete(id: string) {
    fetch(`/api/comments/${id}`, { method: "DELETE" }).then((r) => {
      if (r.ok) setItems((prev) => prev.filter((c) => c.id !== id))
      else toast.error("Xóa thất bại")
    })
  }

  return (
    <div className={cn("border-t pt-8 pb-28 px-5 mx-auto", theme.bar)} style={{ maxWidth: 720 }}>
      <h3 className="font-semibold text-sm mb-6 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Bình luận {items.length > 0 && <span className={cn("font-normal", theme.text)}>({items.length})</span>}
      </h3>

      {userId ? (
        <div className="flex gap-3 mb-8">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold shrink-0 text-primary">
            T
          </div>
          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Chia sẻ cảm nghĩ của bạn về chương này..."
              className="text-sm min-h-[80px] mb-2"
            />
            <Button size="sm" onClick={submit} disabled={sending || !text.trim()}>
              {sending ? "Đang gửi..." : "Gửi bình luận"}
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn("text-sm mb-8 text-center py-3 rounded-lg border", theme.bar, theme.text)}>
          <a href="/sign-in" className="text-primary underline underline-offset-2">Đăng nhập</a> để bình luận
        </p>
      )}

      {loading && items.length === 0 ? (
        <p className={cn("text-sm text-center py-8", theme.text)}>Đang tải...</p>
      ) : items.length === 0 ? (
        <p className={cn("text-sm text-center py-8", theme.text)}>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="space-y-6">
          {items.map((c) => (
            <CommentItem key={c.id} comment={c} novelId={novelId} chapterId={chapterId} userId={userId} onDelete={handleDelete} theme={theme} />
          ))}
          {nextCursor && (
            <button onClick={() => load(nextCursor)} className={cn("w-full text-sm py-2 hover:text-primary transition-colors flex items-center justify-center gap-1", theme.text)}>
              <ChevronDown className="h-4 w-4" /> Xem thêm
            </button>
          )}
        </div>
      )}
    </div>
  )
}
