import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2"
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

  const ext = file.name.includes(".") ? file.name.split(".").pop() : ""
  const key = `goals/${goalId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
    })
  )

  const url = `${R2_PUBLIC_URL}/${key}`

  const attachment = await prisma.attachment.create({
    data: {
      goalId,
      userId: session.user.id,
      name: file.name,
      url,
      fileKey: key,
      mimeType: file.type || "application/octet-stream",
      attachmentType: detectAttachmentType(file.type),
      size: file.size,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
