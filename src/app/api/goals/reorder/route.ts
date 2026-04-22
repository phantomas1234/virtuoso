import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { orderedIds } = parsed.data

  // Verify all IDs belong to the user
  const goals = await prisma.goal.findMany({
    where: { id: { in: orderedIds }, userId: session.user.id },
    select: { id: true },
  })

  if (goals.length !== orderedIds.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.goal.update({
        where: { id },
        data: { position: index },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
