import type { Goal, ProgressEntry, Attachment, GoalType, GoalStatus, AttachmentType, Hand } from "@prisma/client"

export type { GoalType, GoalStatus, AttachmentType, Hand }

export type GoalWithCounts = Goal & {
  _count: {
    progressEntries: number
    attachments: number
  }
  progressEntries?: { bpm: number | null; hand: Hand | null }[]
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
