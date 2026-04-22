interface PdfViewerProps {
  url: string
  name: string
}

export function PdfViewer({ url, name }: PdfViewerProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm">
        <span className="truncate font-medium">{name}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        src={url}
        className="w-full border-0"
        style={{ height: "600px" }}
        title={name}
      />
    </div>
  )
}
