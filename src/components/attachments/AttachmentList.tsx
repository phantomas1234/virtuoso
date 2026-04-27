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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)

  const fetchSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    if (signedUrls[attachment.id]) return signedUrls[attachment.id]
    setLoadingUrl(attachment.id)
    try {
      const res = await fetch(`/api/goals/${goalId}/attachments/${attachment.id}/signed-url`)
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      setSignedUrls((prev) => ({ ...prev, [attachment.id]: url }))
      return url
    } catch {
      toast.error("Failed to load file")
      return null
    } finally {
      setLoadingUrl(null)
    }
  }

  const handleView = async (attachment: Attachment) => {
    if (expanded === attachment.id) {
      setExpanded(null)
      return
    }
    const url = await fetchSignedUrl(attachment)
    if (url) setExpanded(attachment.id)
  }

  const handleOpen = async (attachment: Attachment) => {
    const url = await fetchSignedUrl(attachment)
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

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
        const isLoadingThis = loadingUrl === attachment.id

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
                  onClick={() => handleView(attachment)}
                  disabled={isLoadingThis}
                >
                  {isExpanded ? "Collapse" : "View"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleOpen(attachment)}
                  disabled={isLoadingThis}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
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
            {isExpanded && signedUrls[attachment.id] && (
              <div className="border-t">
                <AttachmentViewer
                  url={signedUrls[attachment.id]}
                  name={attachment.name}
                  attachmentType={attachment.attachmentType}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
