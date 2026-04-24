"use client"

import Link from "next/link"
import { GripVertical, Trophy, Target, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { GoalWithCounts } from "@/types"
import { bpmProgressColor } from "@/lib/utils"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

interface GoalCardProps {
  goal: GoalWithCounts
  dragHandleListeners?: SyntheticListenerMap
  dragHandleAttributes?: DraggableAttributes
  isDragging?: boolean
}

function BpmProgressBar({ bpm, targetBpm, label }: { bpm: number | null; targetBpm: number; label?: string }) {
  const pct = bpm != null ? Math.min(100, Math.round((bpm / targetBpm) * 100)) : null
  const { bar, text } = bpmProgressColor(pct)
  return (
    <div className="space-y-0.5">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className={`text-xs font-medium ${text}`}>
        {pct != null ? `${bpm} BPM — ${pct}%` : "No sessions yet"}
      </p>
    </div>
  )
}

function BpmProgress({ goal }: { goal: GoalWithCounts }) {
  const targetBpm = goal.targetBpm!
  const entries = goal.progressEntries ?? []

  if (goal.splitHands) {
    const latestLeft = entries.find(e => e.hand === "LEFT")?.bpm ?? null
    const latestRight = entries.find(e => e.hand === "RIGHT")?.bpm ?? null
    return (
      <div className="mt-2 space-y-2">
        <BpmProgressBar bpm={latestLeft} targetBpm={targetBpm} label="Left hand" />
        <BpmProgressBar bpm={latestRight} targetBpm={targetBpm} label="Right hand" />
      </div>
    )
  }

  const latestBpm = entries[0]?.bpm ?? null
  return (
    <div className="mt-2">
      <BpmProgressBar bpm={latestBpm} targetBpm={targetBpm} />
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "secondary" }> = {
  ACTIVE: { label: "Active", variant: "secondary" },
  ACCOMPLISHED: { label: "Accomplished", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "warning" },
}

export function GoalCard({ goal, dragHandleListeners, dragHandleAttributes, isDragging }: GoalCardProps) {
  const status = STATUS_LABELS[goal.status]

  return (
    <Card className={`group transition-shadow ${isDragging ? "shadow-lg opacity-75" : "hover:shadow-md"}`}>
      <CardContent className="flex items-start gap-3 p-4">
        <button
          className="mt-1 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...dragHandleListeners}
          {...dragHandleAttributes}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <Link href={`/goals/${goal.id}`} className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {goal.status === "ACCOMPLISHED" && (
                  <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                )}
                <h3 className="font-medium leading-snug truncate">{goal.title}</h3>
              </div>
              {goal.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{goal.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={status.variant}>{status.label}</Badge>
              {goal.goalType === "BPM" && (
                <Badge variant="outline" className="font-mono gap-1">
                  <Target className="h-3 w-3" />
                  {goal.targetBpm} BPM
                </Badge>
              )}
            </div>
          </div>

          {goal.goalType === "BPM" && goal.targetBpm && <BpmProgress goal={goal} />}

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {goal.goalType === "BPM" && (
              <span>{goal._count.progressEntries} session{goal._count.progressEntries !== 1 ? "s" : ""} logged</span>
            )}
            {goal._count.attachments > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {goal._count.attachments} attachment{goal._count.attachments !== 1 ? "s" : ""}
              </span>
            )}
            {goal.accomplishedAt && (
              <span className="text-emerald-600 dark:text-emerald-400">
                Completed {new Date(goal.accomplishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
