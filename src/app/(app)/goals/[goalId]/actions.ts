"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { AttachmentType } from "@prisma/client"

interface AttachmentData {
  name: string
  url: string
  fileKey?: string
  mimeType: string
  attachmentType: AttachmentType
  size?: number
}

export async function createAttachmentRecord(goalId: string, data: AttachmentData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } })
  if (!goal || goal.userId !== session.user.id) throw new Error("Forbidden")

  await prisma.attachment.create({
    data: {
      goalId,
      userId: session.user.id,
      ...data,
    },
  })

  revalidatePath(`/goals/${goalId}`)
}

export async function markGoalAccomplished(goalId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== session.user.id) throw new Error("Forbidden")

  await prisma.goal.update({
    where: { id: goalId },
    data: { status: "ACCOMPLISHED", accomplishedAt: new Date() },
  })

  revalidatePath(`/goals/${goalId}`)
  revalidatePath("/dashboard")
}

export async function markGoalActive(goalId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== session.user.id) throw new Error("Forbidden")

  await prisma.goal.update({
    where: { id: goalId },
    data: { status: "ACTIVE", accomplishedAt: null },
  })

  revalidatePath(`/goals/${goalId}`)
  revalidatePath("/dashboard")
}

export async function archiveGoal(goalId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== session.user.id) throw new Error("Forbidden")

  await prisma.goal.update({ where: { id: goalId }, data: { status: "ARCHIVED" } })

  revalidatePath(`/goals/${goalId}`)
  revalidatePath("/dashboard")
}

export async function deleteGoal(goalId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== session.user.id) throw new Error("Forbidden")

  await prisma.goal.delete({ where: { id: goalId } })

  revalidatePath("/dashboard")
}
