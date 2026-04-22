"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AttachmentUploaderProps {
  goalId: string
}

function detectAttachmentType(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("audio/")) return "AUDIO"
  return "OTHER"
}

export function AttachmentUploader({ goalId }: AttachmentUploaderProps) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("goalId", goalId)

        const res = await fetch(`/api/goals/${goalId}/attachments/upload`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          toast.error(`Failed to upload ${file.name}`)
          continue
        }

        toast.success(`${file.name} uploaded`)
      }
      router.refresh()
    } catch {
      toast.error("Upload failed. Please try again.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div>
      <label htmlFor="file-upload">
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={uploading}
          className="cursor-pointer"
        >
          <span>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Upload files"}
          </span>
        </Button>
      </label>
      <input
        id="file-upload"
        type="file"
        multiple
        className="sr-only"
        accept=".pdf,.mp4,.mov,.avi,.webm,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.aac"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <p className="mt-1 text-xs text-muted-foreground">PDF, video, image, or audio files</p>
    </div>
  )
}
