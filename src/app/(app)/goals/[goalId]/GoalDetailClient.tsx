"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProgressEntryForm } from "@/components/progress/ProgressEntryForm"
import { ProgressHistory } from "@/components/progress/ProgressHistory"
import { ConfettiTrigger } from "@/components/shared/ConfettiCannon"
import type { Goal, ProgressEntry, Attachment } from "@prisma/client"

interface GoalDetailClientProps {
  goal: Goal & { progressEntries: ProgressEntry[]; attachments: Attachment[] }
}

export function GoalDetailClient({ goal }: GoalDetailClientProps) {
  const router = useRouter()
  const [celebrate, setCelebrate] = useState(false)

  const handleProgressSuccess = (_entry: ProgressEntry, goalAccomplished: boolean) => {
    if (goalAccomplished) setCelebrate(true)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <ConfettiTrigger trigger={celebrate} />
      <ProgressEntryForm
        goalId={goal.id}
        goalType={goal.goalType}
        onSuccess={handleProgressSuccess}
      />
      <ProgressHistory
        entries={goal.progressEntries}
        goalId={goal.id}
        goalType={goal.goalType}
      />
    </div>
  )
}
