"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export type Theme = "light" | "dark" | "night"
export type FontFamily = "serif" | "sans"

export interface ReaderPrefs {
  fontSize: number
  lineHeight: number
  width: number
  theme: Theme
  fontFamily: FontFamily
}

const DEFAULTS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.85,
  width: 680,
  theme: "light",
  fontFamily: "serif",
}

export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reader-prefs")
      if (stored) {
        const parsed = { ...DEFAULTS, ...JSON.parse(stored) }
        setPrefs(parsed)
        document.documentElement.classList.toggle("dark", parsed.theme !== "light")
      } else {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        const theme: Theme = systemDark ? "night" : "light"
        setPrefs({ ...DEFAULTS, theme })
        document.documentElement.classList.toggle("dark", theme !== "light")
      }
    } catch {}
  }, [])

  function update(patch: Partial<ReaderPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem("reader-prefs", JSON.stringify(next))
      if (patch.theme !== undefined) {
        document.documentElement.classList.toggle("dark", patch.theme !== "light")
      }
      return next
    })
  }

  return { prefs, update }
}

const THEMES: { value: Theme; label: string; bg: string; text: string }[] = [
  { value: "light", label: "Sáng",  bg: "bg-[#faf9f6]",  text: "text-zinc-800" },
  { value: "dark",  label: "Tối",   bg: "bg-[#212121]",  text: "text-zinc-200" },
  { value: "night", label: "Đêm",   bg: "bg-[#0f0f0f]",  text: "text-zinc-400" },
]

const FONTS: { value: FontFamily; label: string; className: string }[] = [
  { value: "serif", label: "Serif",    className: "font-[family-name:var(--font-lora)] italic" },
  { value: "sans",  label: "Sans",     className: "font-[family-name:var(--font-sans)]" },
]

export function ReaderSettingsButton({
  prefs,
  onUpdate,
}: {
  prefs: ReaderPrefs
  onUpdate: (p: Partial<ReaderPrefs>) => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="p-2 rounded-md hover:bg-black/5 transition-colors text-inherit opacity-60 hover:opacity-100">
          <Settings className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-sm">Cài đặt đọc</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-7 px-1">

          {/* Theme */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Giao diện</p>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onUpdate({ theme: t.value })}
                  className={cn(
                    "flex-1 rounded-md py-3 text-xs font-medium transition-all border-2",
                    t.bg, t.text,
                    prefs.theme === t.value ? "border-primary shadow-sm" : "border-transparent"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Kiểu chữ</p>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onUpdate({ fontFamily: f.value })}
                  className={cn(
                    "flex-1 rounded-md py-3 text-sm border-2 transition-all bg-muted",
                    f.className,
                    prefs.fontFamily === f.value ? "border-primary" : "border-transparent"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cỡ chữ</p>
              <span className="text-xs text-muted-foreground">{prefs.fontSize}px</span>
            </div>
            <Slider
              min={14} max={26} step={1}
              value={[prefs.fontSize]}
              onValueChange={([v]) => onUpdate({ fontSize: v })}
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>A</span><span className="text-base">A</span>
            </div>
          </div>

          {/* Line height */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Khoảng cách dòng</p>
              <span className="text-xs text-muted-foreground">{prefs.lineHeight}×</span>
            </div>
            <Slider
              min={1.4} max={2.2} step={0.1}
              value={[prefs.lineHeight]}
              onValueChange={([v]) => onUpdate({ lineHeight: Number(v.toFixed(1)) })}
            />
          </div>

          {/* Width */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Độ rộng</p>
              <span className="text-xs text-muted-foreground">{prefs.width}px</span>
            </div>
            <Slider
              min={480} max={900} step={20}
              value={[prefs.width]}
              onValueChange={([v]) => onUpdate({ width: v })}
            />
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
