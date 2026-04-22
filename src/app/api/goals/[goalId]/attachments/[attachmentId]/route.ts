import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
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

  try {
    await del(attachment.url)
  } catch {
    // Continue even if blob deletion fails
  }

  await prisma.attachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
