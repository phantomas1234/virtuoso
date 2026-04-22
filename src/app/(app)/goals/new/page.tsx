import { GoalForm } from "@/components/goals/GoalForm"

export default function NewGoalPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">New goal</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Set a clear target and start tracking your progress.
        </p>
      </div>
      <GoalForm />
    </div>
  )
}
