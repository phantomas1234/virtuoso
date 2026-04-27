import { PdfViewer } from "./PdfViewer"
import { VideoPlayer } from "./VideoPlayer"
import type { AttachmentType } from "@prisma/client"

interface AttachmentViewerProps {
  url: string
  name: string
  attachmentType: AttachmentType
}

export function AttachmentViewer({ url, name, attachmentType }: AttachmentViewerProps) {
  switch (attachmentType) {
    case "PDF":
      return <PdfViewer url={url} name={name} />

    case "VIDEO":
      return <VideoPlayer url={url} name={name} />

    case "IMAGE":
      return (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="w-full object-contain"
            style={{ maxHeight: "480px" }}
          />
        </div>
      )

    case "AUDIO":
      return (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <span className="text-sm font-medium">{name}</span>
          <audio src={url} controls className="w-full">
            <track kind="captions" />
          </audio>
        </div>
      )

    default:
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
        >
          {name}
        </a>
      )
  }
}
