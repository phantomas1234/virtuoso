import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { GoalForm } from "@/components/goals/GoalForm"

export default async function EditGoalPage({ params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  const { goalId } = await params

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal) notFound()
  if (goal.userId !== session!.user!.id) notFound()

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Edit goal</h1>
        <p className="mt-1 text-muted-foreground text-sm">Update the details of your goal.</p>
      </div>
      <GoalForm goal={goal} />
    </div>
  )
}
