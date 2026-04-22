"use client"

import { useState } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { GoalType, ProgressEntry } from "@prisma/client"

const schema = z.object({
  bpm: z.number().int().positive().optional(),
  note: z.string().optional(),
  date: z.string().min(1),
})

type FormData = z.infer<typeof schema>

interface ProgressEntryFormProps {
  goalId: string
  goalType: GoalType
  onSuccess: (entry: ProgressEntry, goalAccomplished: boolean) => void
}

export function ProgressEntryForm({ goalId, goalType, onSuccess }: ProgressEntryFormProps) {
  const [isOpen, setIsOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
    },
  })

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        toast.error("Failed to log progress")
        return
      }

      const { entry, goalAccomplished } = await res.json()
      onSuccess(entry, goalAccomplished)
      reset({ date: format(new Date(), "yyyy-MM-dd") })
      setIsOpen(false)

      if (goalAccomplished) {
        toast.success("You hit your target! Goal accomplished!", { duration: 5000 })
      } else {
        toast.success("Progress logged!")
      }
    } catch {
      toast.error("Network error. Please try again.")
    }
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        + Log session
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border p-4 space-y-4 bg-muted/30">
      <div className="flex gap-4 flex-wrap">
        {goalType === "BPM" && (
          <div className="space-y-1 w-32">
            <Label htmlFor="bpm" className="text-xs">BPM achieved</Label>
            <Input
              id="bpm"
              type="number"
              min={1}
              max={999}
              placeholder="120"
              className="font-mono"
              {...register("bpm", { valueAsNumber: true })}
            />
            {errors.bpm && <p className="text-xs text-destructive">{errors.bpm.message}</p>}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="date" className="text-xs">Date</Label>
          <Input id="date" type="date" className="w-36" {...register("date")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="note" className="text-xs">Notes (optional)</Label>
        <Textarea id="note" placeholder="What went well? What to work on?" rows={2} {...register("note")} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
