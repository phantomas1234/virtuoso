import { NextRequest, NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { r2, R2_BUCKET } from "@/lib/r2"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type Params = { goalId: string; attachmentId: string }

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId, attachmentId } = await params

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { goal: { select: { userId: true } } },
  })

  if (!attachment || attachment.goalId !== goalId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (attachment.goal.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (attachment.fileKey) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.fileKey }))
    } catch {
      // Continue even if R2 deletion fails
    }
  }

  await prisma.attachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
