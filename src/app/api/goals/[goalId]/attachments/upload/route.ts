import { NextRequest, NextResponse } from "next/server"
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

  const { key, name, mimeType, size } = await req.json()
  if (!key || !name || !mimeType) return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

  const attachment = await prisma.attachment.create({
    data: {
      goalId,
      userId: session.user.id,
      name,
      url: key,
      fileKey: key,
      mimeType,
      attachmentType: detectAttachmentType(mimeType),
      size,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
