import { NextRequest, NextResponse } from "next/server"
import { getSignedUrl } from "@/lib/r2"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type Params = { goalId: string; attachmentId: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
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

  const key = attachment.fileKey ?? attachment.url
  const url = await getSignedUrl(key)
  return NextResponse.json({ url })
}
