"use client"

import { useState } from "react"
import { Trash2, FileText, Film, Image, Music, File, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AttachmentViewer } from "./AttachmentViewer"
import type { Attachment, AttachmentType } from "@prisma/client"

const ICONS: Record<AttachmentType, typeof File> = {
  PDF: FileText,
  VIDEO: Film,
  IMAGE: Image,
  AUDIO: Music,
  OTHER: File,
}

interface AttachmentListProps {
  attachments: Attachment[]
  goalId: string
}

export function AttachmentList({ attachments, goalId }: AttachmentListProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const deleteAttachment = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/goals/${goalId}/attachments/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Attachment deleted")
      router.refresh()
    } catch {
      toast.error("Failed to delete attachment")
    } finally {
      setDeleting(null)
    }
  }

  if (attachments.length === 0) return null

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const Icon = ICONS[attachment.attachmentType]
        const isExpanded = expanded === attachment.id

        return (
          <div key={attachment.id} className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium truncate">{attachment.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setExpanded(isExpanded ? null : attachment.id)}
                >
                  {isExpanded ? "Collapse" : "View"}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteAttachment(attachment.id)}
                  disabled={deleting === attachment.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t">
                <AttachmentViewer attachment={attachment} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
