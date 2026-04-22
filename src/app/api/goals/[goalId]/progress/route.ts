import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const createEntrySchema = z.object({
  bpm: z.number().int().positive().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } })
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const entries = await prisma.progressEntry.findMany({
    where: { goalId },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(entries)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await params
  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (goal.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createEntrySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { bpm, note, date } = parsed.data

  const entry = await prisma.progressEntry.create({
    data: {
      goalId,
      bpm: goal.goalType === "BPM" ? bpm : null,
      note,
      date: date ? new Date(date) : new Date(),
    },
  })

  // Auto-accomplishment check
  let goalAccomplished = false
  if (
    goal.goalType === "BPM" &&
    goal.status === "ACTIVE" &&
    goal.targetBpm !== null &&
    bpm !== undefined &&
    bpm >= goal.targetBpm
  ) {
    await prisma.goal.update({
      where: { id: goalId },
      data: { status: "ACCOMPLISHED", accomplishedAt: new Date() },
    })
    goalAccomplished = true
  }

  return NextResponse.json({ entry, goalAccomplished }, { status: 201 })
}
