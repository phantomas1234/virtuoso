"use client"

import Link from "next/link"
import { GripVertical, Trophy, Target, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { GoalWithCounts } from "@/types"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

interface GoalCardProps {
  goal: GoalWithCounts
  dragHandleListeners?: SyntheticListenerMap
  dragHandleAttributes?: DraggableAttributes
  isDragging?: boolean
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
