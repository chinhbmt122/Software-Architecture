"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const schema = z.object({
  chapterNumber: z.number().int().positive("Must be a positive number"),
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  isVip: z.boolean(),
  coinCost: z.number().int().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]),
  publishedAt: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  novelId: string
  chapterId?: string
  defaultValues?: Partial<FormData>
  nextChapterNumber?: number
}

export function ChapterForm({ novelId, chapterId, defaultValues, nextChapterNumber }: Props) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      chapterNumber: nextChapterNumber ?? 1,
      status: "DRAFT",
      isVip: false,
      coinCost: 1,
      ...defaultValues,
    },
  })

  const isVip = watch("isVip")
  const status = watch("status")

  async function onSubmit(data: FormData) {
    const url = chapterId
      ? `/api/novels/${novelId}/chapters/${chapterId}`
      : `/api/novels/${novelId}/chapters`
    const method = chapterId ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        publishedAt: data.publishedAt || null,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      toast.error("Failed to save chapter")
      console.error(err)
      return
    }

    toast.success(chapterId ? "Chapter updated" : "Chapter created")
    router.push(`/curator/novels/${novelId}/chapters`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="chapterNumber">Chapter Number *</Label>
          <Input id="chapterNumber" type="number" {...register("chapterNumber", { valueAsNumber: true })} />
          {errors.chapterNumber && <p className="text-sm text-destructive">{errors.chapterNumber.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setValue("status", v as FormData["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register("title")} placeholder="Chapter title" />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      {status === "SCHEDULED" && (
        <div className="space-y-1">
          <Label htmlFor="publishedAt">Publish At</Label>
          <Input id="publishedAt" type="datetime-local" {...register("publishedAt")} />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          {...register("content")}
          rows={20}
          placeholder="Chapter content..."
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isVip"
            checked={isVip}
            onChange={(e) => setValue("isVip", e.target.checked)}
            className="rounded border"
          />
          <Label htmlFor="isVip">VIP Chapter</Label>
        </div>
        {isVip && (
          <div className="flex items-center gap-2">
            <Label htmlFor="coinCost">Coin cost</Label>
            <Input id="coinCost" type="number" min={1} {...register("coinCost", { valueAsNumber: true })} className="w-20" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : chapterId ? "Update Chapter" : "Save Chapter"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
