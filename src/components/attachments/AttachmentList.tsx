"use client"

import { useState } from "react"
import { Trash2, FileText, Film, Image, Music, File, ExternalLink, Loader2, Drum, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AttachmentViewer } from "./AttachmentViewer"
import { DrumPlayer } from "./DrumPlayer"
import type { Attachment, AttachmentType, DrumScore } from "@prisma/client"
import type { DrumScoreData } from "@/app/api/goals/[goalId]/attachments/[attachmentId]/parse-drums/route"

const ICONS: Record<AttachmentType, typeof File> = {
  PDF: FileText,
  VIDEO: Film,
  IMAGE: Image,
  AUDIO: Music,
  OTHER: File,
}

interface AttachmentWithDrumScore extends Attachment {
  drumScore?: DrumScore | null
}

interface AttachmentListProps {
  attachments: AttachmentWithDrumScore[]
  goalId: string
}

export function AttachmentList({ attachments, goalId }: AttachmentListProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)
  const [parsing, setParsing] = useState<string | null>(null)

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

  const parseDrums = async (attachment: AttachmentWithDrumScore) => {
    setParsing(attachment.id)
    try {
      const res = await fetch(
        `/api/goals/${goalId}/attachments/${attachment.id}/parse-drums`,
        { method: "POST" }
      )
      if (res.status === 422) {
        const data = await res.json()
        toast.error(`Could not parse drums: ${data.error ?? "Unrecognised notation"}`)
      } else if (!res.ok) {
        throw new Error()
      } else {
        toast.success("Drum score ready — press Play!")
        const url = await fetchSignedUrl(attachment)
        if (url) setExpanded(attachment.id)
      }
      router.refresh()
    } catch {
      toast.error("Parsing failed — check console for details")
    } finally {
      setParsing(null)
    }
  }

  if (attachments.length === 0) return null

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const Icon = ICONS[attachment.attachmentType]
        const isExpanded = expanded === attachment.id
        const isLoadingThis = loadingUrl === attachment.id
        const ds = attachment.drumScore
        const isParsing = parsing === attachment.id
        const isPDF = attachment.attachmentType === "PDF"

        return (
          <div key={attachment.id} className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium truncate">{attachment.name}</span>
              <div className="flex items-center gap-1">
                {/* Drum parse button — only for PDFs */}
                {isPDF && (
                  <>
                    {ds?.status === "READY" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2">
                        <Drum className="h-3.5 w-3.5" />
                        Playable
                      </span>
                    ) : ds?.status === "PROCESSING" || isParsing ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground px-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Parsing…
                      </span>
                    ) : ds?.status === "FAILED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                        onClick={() => parseDrums(attachment)}
                        disabled={!!parsing}
                        title={ds.errorMessage ?? "Parsing failed"}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => parseDrums(attachment)}
                        disabled={!!parsing}
                      >
                        <Drum className="h-3.5 w-3.5" />
                        Parse Drums
                      </Button>
                    )}
                  </>
                )}

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
              <div className="border-t space-y-3 p-3">
                <AttachmentViewer
                  url={signedUrls[attachment.id]}
                  name={attachment.name}
                  attachmentType={attachment.attachmentType}
                />
                {isPDF && ds?.status === "READY" && ds.data && (
                  <DrumPlayer
                    score={ds.data as unknown as DrumScoreData}
                    suggestedBpm={ds.suggestedBpm}
                  />
                )}
                {isPDF && ds?.status === "FAILED" && ds.errorMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Could not parse drum notation</p>
                      <p className="text-xs mt-0.5 text-destructive/70">{ds.errorMessage}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 text-xs text-destructive hover:text-destructive gap-1 px-2"
                        onClick={() => parseDrums(attachment)}
                        disabled={!!parsing}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
