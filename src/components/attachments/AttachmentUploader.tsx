"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AttachmentUploaderProps {
  goalId: string
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
        // Step 1: get a pre-signed PUT URL from our API
        const presignRes = await fetch(`/api/goals/${goalId}/attachments/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
        })
        if (!presignRes.ok) {
          const { error } = await presignRes.json()
          toast.error(error ?? `Failed to upload ${file.name}`)
          continue
        }
        const { uploadUrl, key } = await presignRes.json()

        // Step 2: upload directly to R2 (bypasses Vercel body size limits)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })
        if (!uploadRes.ok) {
          toast.error(`Failed to upload ${file.name}`)
          continue
        }

        // Step 3: record the attachment in the database
        const confirmRes = await fetch(`/api/goals/${goalId}/attachments/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, name: file.name, mimeType: file.type, size: file.size }),
        })
        if (!confirmRes.ok) {
          toast.error(`Failed to save ${file.name}`)
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
