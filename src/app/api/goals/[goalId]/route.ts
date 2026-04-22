import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { del } from "@vercel/blob"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  targetBpm: z.number().int().positive().nullable().optional(),
  youtubeUrl: z.string().url().optional().or(z.literal("")).nullable().optional(),
  status: z.enum(["ACTIVE", "ACCOMPLISHED", "ARCHIVED"]).optional(),
})

async function getGoalForUser(goalId: string, userId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal) return null
  if (goal.userId !== userId) return "forbidden"
  return goal
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await getGoalForUser(goalId, session.user.id)
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const full = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      progressEntries: { orderBy: { date: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  })

  return NextResponse.json(full)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await getGoalForUser(goalId, session.user.id)
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateGoalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const updateData: Record<string, unknown> = { ...data }

  if (data.status === "ACCOMPLISHED" && goal.status !== "ACCOMPLISHED") {
    updateData.accomplishedAt = new Date()
  }
  if (data.status === "ACTIVE") {
    updateData.accomplishedAt = null
  }

  const updated = await prisma.goal.update({ where: { id: goalId }, data: updateData })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await getGoalForUser(goalId, session.user.id)
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Clean up Blob files before deleting
  const attachments = await prisma.attachment.findMany({
    where: { goalId },
    select: { url: true },
  })
  for (const a of attachments) {
    try { await del(a.url) } catch { /* ignore */ }
  }

  await prisma.goal.delete({ where: { id: goalId } })
  return NextResponse.json({ ok: true })
}
