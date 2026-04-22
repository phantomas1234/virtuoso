import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { AttachmentType } from "@prisma/client"

function detectAttachmentType(mimeType: string): AttachmentType {
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("audio/")) return "AUDIO"
  return "OTHER"
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } })
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const MAX_SIZE = 256 * 1024 * 1024 // 256 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 256 MB)" }, { status: 413 })
  }

  const blob = await put(`goals/${goalId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  })

  const attachment = await prisma.attachment.create({
    data: {
      goalId,
      userId: session.user.id,
      name: file.name,
      url: blob.url,
      fileKey: blob.pathname,
      mimeType: file.type || "application/octet-stream",
      attachmentType: detectAttachmentType(file.type),
      size: file.size,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
