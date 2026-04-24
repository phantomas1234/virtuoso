import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  goalType: z.enum(["BPM", "OPEN"]),
  targetBpm: z.number().int().positive().optional(),
  splitHands: z.boolean().optional(),
  youtubeUrl: z.string().url().optional().or(z.literal("")),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const goals = await prisma.goal.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as "ACTIVE" | "ACCOMPLISHED" | "ARCHIVED" } : {}),
    },
    orderBy: { position: "asc" },
    include: {
      _count: { select: { progressEntries: true, attachments: true } },
    },
  })

  return NextResponse.json(goals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createGoalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { title, description, goalType, targetBpm, splitHands, youtubeUrl } = parsed.data

  const maxPosition = await prisma.goal.aggregate({
    where: { userId: session.user.id },
    _max: { position: true },
  })
  const position = (maxPosition._max.position ?? -1) + 1

  const goal = await prisma.goal.create({
    data: {
      userId: session.user.id,
      title,
      description,
      goalType,
      targetBpm: goalType === "BPM" ? targetBpm : null,
      splitHands: goalType === "BPM" ? (splitHands ?? false) : false,
      youtubeUrl: youtubeUrl || null,
      position,
    },
  })

  return NextResponse.json(goal, { status: 201 })
}
