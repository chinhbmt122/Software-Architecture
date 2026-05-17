"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  referenceType: string
  referenceId: string
  isRead: boolean
  createdAt: string
}

interface Props {
  initialUnread: number
}

export function NotificationBell({ initialUnread }: Props) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function handleOpen() {
    setOpen((v) => !v)
    if (!loaded) {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setLoaded(true)
      }
    }
    if (unread > 0) {
      fetch("/api/notifications/read", { method: "POST" })
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl border bg-background shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Thông báo</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Đang tải...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Không có thông báo nào.</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className={cn("px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0", !n.isRead && "bg-primary/5")}>
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: vi })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
