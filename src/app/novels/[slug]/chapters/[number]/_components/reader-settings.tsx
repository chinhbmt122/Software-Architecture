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
  theme: "dark",
  fontFamily: "serif",
}

const STORAGE_KEY = "reader-settings"
const LEGACY_STORAGE_KEY = "reader-prefs"

function clamp(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizePrefs(value: unknown): ReaderPrefs {
  if (!value || typeof value !== "object") return DEFAULTS
  const raw = value as Partial<ReaderPrefs>
  return {
    fontSize: clamp(raw.fontSize, 14, 26, DEFAULTS.fontSize),
    lineHeight: Number(clamp(raw.lineHeight, 1.4, 2.2, DEFAULTS.lineHeight).toFixed(2)),
    width: clamp(raw.width, 480, 900, DEFAULTS.width),
    theme: raw.theme === "light" || raw.theme === "dark" || raw.theme === "night" ? raw.theme : DEFAULTS.theme,
    fontFamily: raw.fontFamily === "sans" || raw.fontFamily === "serif" ? raw.fontFamily : DEFAULTS.fontFamily,
  }
}

export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      if (stored) {
        const parsed = normalizePrefs(JSON.parse(stored))
        setPrefs(parsed)
      }
    } catch {}
  }, [])

  function update(patch: Partial<ReaderPrefs>) {
    setPrefs((prev) => {
      const next = normalizePrefs({ ...prev, ...patch })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
        <button
          aria-label="Reader settings"
          data-testid="reader-settings"
          className="p-2 rounded-md hover:bg-black/5 transition-colors text-inherit opacity-60 hover:opacity-100"
        >
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
              aria-label="Font size"
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
              aria-label="Line height"
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
              aria-label="Content width"
              min={480} max={900} step={10}
              value={[prefs.width]}
              onValueChange={([v]) => onUpdate({ width: v })}
            />
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
