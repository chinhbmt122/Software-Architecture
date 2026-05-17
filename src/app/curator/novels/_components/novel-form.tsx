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
  title: z.string().min(1, "Title is required"),
  synopsis: z.string().optional(),
  coverImageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["ONGOING", "COMPLETED", "HIATUS", "DROPPED"]),
  originalLanguage: z.enum(["VI", "ZH", "KO", "JA", "EN"]),
  isFeatured: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  novelId?: string
  defaultValues?: Partial<FormData>
}

export function NovelForm({ novelId, defaultValues }: Props) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "ONGOING",
      originalLanguage: "ZH",
      ...defaultValues,
    },
  })

  async function onSubmit(data: FormData) {
    const url = novelId ? `/api/novels/${novelId}` : "/api/novels"
    const method = novelId ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Failed to save novel")
      return
    }
    const novel = await res.json()
    toast.success(novelId ? "Novel updated" : "Novel created")
    router.push(`/curator/novels/${novel.id}/chapters`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register("title")} placeholder="Novel title" />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="synopsis">Synopsis</Label>
        <Textarea id="synopsis" {...register("synopsis")} rows={5} placeholder="Brief description..." />
      </div>

      <div className="space-y-1">
        <Label htmlFor="coverImageUrl">Cover Image URL</Label>
        <Input id="coverImageUrl" {...register("coverImageUrl")} placeholder="https://..." />
        {errors.coverImageUrl && <p className="text-sm text-destructive">{errors.coverImageUrl.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormData["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="HIATUS">Hiatus</SelectItem>
              <SelectItem value="DROPPED">Dropped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Original Language</Label>
          <Select value={watch("originalLanguage")} onValueChange={(v) => setValue("originalLanguage", v as FormData["originalLanguage"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ZH">Chinese</SelectItem>
              <SelectItem value="KO">Korean</SelectItem>
              <SelectItem value="JA">Japanese</SelectItem>
              <SelectItem value="EN">English</SelectItem>
              <SelectItem value="VI">Vietnamese</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isFeatured"
          {...register("isFeatured")}
          className="rounded border"
        />
        <Label htmlFor="isFeatured">Featured on homepage</Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : novelId ? "Update Novel" : "Create Novel"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
