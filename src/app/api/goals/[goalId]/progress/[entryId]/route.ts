import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const updateEntrySchema = z.object({
  bpm: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  date: z.string().optional(),
})

type Params = { goalId: string; entryId: string }

async function getEntryForUser(entryId: string, goalId: string, userId: string) {
  const entry = await prisma.progressEntry.findUnique({
    where: { id: entryId },
    include: { goal: { select: { userId: true } } },
  })
  if (!entry || entry.goalId !== goalId) return null
  if (entry.goal.userId !== userId) return "forbidden"
  return entry
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId, entryId } = await params
  const entry = await getEntryForUser(entryId, goalId, session.user.id)
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (entry === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateEntrySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { bpm, note, date } = parsed.data
  const updated = await prisma.progressEntry.update({
    where: { id: entryId },
    data: {
      ...(bpm !== undefined ? { bpm } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(date ? { date: new Date(date) } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId, entryId } = await params
  const entry = await getEntryForUser(entryId, goalId, session.user.id)
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (entry === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.progressEntry.delete({ where: { id: entryId } })
  return NextResponse.json({ ok: true })
}
