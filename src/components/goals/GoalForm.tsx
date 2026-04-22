"use client"

import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Goal } from "@prisma/client"

const schema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().optional(),
    goalType: z.enum(["BPM", "OPEN"]),
    targetBpm: z.number().int().positive().optional(),
    youtubeUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  })
  .refine((d) => d.goalType !== "BPM" || (d.targetBpm !== undefined && d.targetBpm > 0), {
    message: "Target BPM is required for BPM goals",
    path: ["targetBpm"],
  })

type FormData = z.infer<typeof schema>

interface GoalFormProps {
  goal?: Goal
}

export function GoalForm({ goal }: GoalFormProps) {
  const router = useRouter()
  const isEdit = !!goal

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      title: goal?.title ?? "",
      description: goal?.description ?? "",
      goalType: (goal?.goalType as "BPM" | "OPEN") ?? "OPEN",
      targetBpm: goal?.targetBpm ?? undefined,
      youtubeUrl: goal?.youtubeUrl ?? "",
    },
  })

  const goalType = watch("goalType")

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const url = isEdit ? `/api/goals/${goal.id}` : "/api/goals"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message || "Something went wrong")
        return
      }

      const result = await res.json()
      toast.success(isEdit ? "Goal updated!" : "Goal created!")
      router.push(`/goals/${isEdit ? goal.id : result.id}`)
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. Play single stroke 16th at 200 BPM"
          {...register("title")}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Add any details, context, or practice notes…"
          rows={3}
          {...register("description")}
        />
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label>Goal type</Label>
          <Select
            value={goalType}
            onValueChange={(v) => setValue("goalType", v as "BPM" | "OPEN")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BPM">BPM — track tempo progress with a chart</SelectItem>
              <SelectItem value="OPEN">Open — freeform, mark complete manually</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {goalType === "BPM" && (
        <div className="space-y-2">
          <Label htmlFor="targetBpm">Target BPM</Label>
          <Input
            id="targetBpm"
            type="number"
            min={1}
            max={999}
            placeholder="200"
            className="font-mono"
            {...register("targetBpm", { valueAsNumber: true })}
          />
          {errors.targetBpm && <p className="text-sm text-destructive">{errors.targetBpm.message}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="youtubeUrl">YouTube reference (optional)</Label>
        <Input
          id="youtubeUrl"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          {...register("youtubeUrl")}
        />
        {errors.youtubeUrl && <p className="text-sm text-destructive">{errors.youtubeUrl.message}</p>}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create goal"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
