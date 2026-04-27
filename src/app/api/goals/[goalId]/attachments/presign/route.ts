import { NextRequest, NextResponse } from "next/server"
import { getPresignedUploadUrl } from "@/lib/r2"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const MAX_SIZE = 256 * 1024 * 1024 // 256 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { goalId } = await params
    const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } })
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (goal.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { fileName, contentType, size } = await req.json()
    if (!fileName || !contentType) return NextResponse.json({ error: "Missing fileName or contentType" }, { status: 400 })
    if (size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 256 MB)" }, { status: 413 })

    const ext = fileName.includes(".") ? fileName.split(".").pop() : ""
    const key = `goals/${goalId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`
    const uploadUrl = await getPresignedUploadUrl(key)

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    console.error("[presign] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
