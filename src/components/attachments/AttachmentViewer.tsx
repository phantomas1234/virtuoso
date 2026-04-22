import { PdfViewer } from "./PdfViewer"
import type { Attachment } from "@prisma/client"

interface AttachmentViewerProps {
  attachment: Attachment
}

export function AttachmentViewer({ attachment }: AttachmentViewerProps) {
  switch (attachment.attachmentType) {
    case "PDF":
      return <PdfViewer url={attachment.url} name={attachment.name} />

    case "VIDEO":
      return (
        <div className="overflow-hidden rounded-lg border">
          <video
            src={attachment.url}
            controls
            className="w-full"
            style={{ maxHeight: "480px" }}
          >
            <track kind="captions" />
          </video>
        </div>
      )

    case "IMAGE":
      return (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.name}
            className="w-full object-contain"
            style={{ maxHeight: "480px" }}
          />
        </div>
      )

    case "AUDIO":
      return (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-sm font-medium">{attachment.name}</span>
          <audio src={attachment.url} controls className="w-full">
            <track kind="captions" />
          </audio>
        </div>
      )

    default:
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
        >
          {attachment.name}
        </a>
      )
  }
}
