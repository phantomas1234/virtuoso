import type { Goal, ProgressEntry, Attachment, GoalType, GoalStatus, AttachmentType } from "@prisma/client"

export type { GoalType, GoalStatus, AttachmentType }

export type GoalWithCounts = Goal & {
  _count: {
    progressEntries: number
    attachments: number
  }
}

export type GoalWithDetails = Goal & {
  progressEntries: ProgressEntry[]
  attachments: Attachment[]
}

export interface GoalFormData {
  title: string
  description?: string
  goalType: GoalType
  targetBpm?: number
  youtubeUrl?: string
}

export interface ProgressEntryFormData {
  bpm?: number
  note?: string
  date: string
}
