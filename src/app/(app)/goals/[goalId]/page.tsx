import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Pencil, Trophy, RotateCcw, Archive, Trash2 } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { YouTubeEmbed } from "@/components/attachments/YouTubeEmbed"
import { AttachmentList } from "@/components/attachments/AttachmentList"
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader"
import { ProjectionChart } from "@/components/progress/ProjectionChart"
import { Metronome } from "@/components/goals/Metronome"
import { GoalDetailClient } from "./GoalDetailClient"
import { markGoalAccomplished, markGoalActive, archiveGoal, deleteGoal } from "./actions"

export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  const { goalId } = await params

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      progressEntries: { orderBy: { date: "asc" } },
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { drumScore: true },
      },
    },
  })

  if (!goal) notFound()
  if (goal.userId !== session!.user!.id) notFound()

  const isActive = goal.status === "ACTIVE"
  const isAccomplished = goal.status === "ACCOMPLISHED"

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isAccomplished && <Trophy className="h-5 w-5 text-amber-500 shrink-0" />}
              <h1 className="text-2xl font-bold tracking-tight leading-snug">{goal.title}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isAccomplished ? "success" : goal.status === "ARCHIVED" ? "warning" : "secondary"}>
                {goal.status.charAt(0) + goal.status.slice(1).toLowerCase()}
              </Badge>
              {goal.goalType === "BPM" && goal.targetBpm && (
                <Badge variant="outline" className="font-mono">Target: {goal.targetBpm} BPM</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`/goals/${goal.id}/edit`}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        {goal.description && (
          <p className="text-muted-foreground leading-relaxed">{goal.description}</p>
        )}

        {goal.accomplishedAt && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            Accomplished on {new Date(goal.accomplishedAt).toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        )}

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          {isActive && (
            <form action={markGoalAccomplished.bind(null, goal.id)}>
              <Button size="sm" variant="outline" type="submit" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950">
                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                Mark accomplished
              </Button>
            </form>
          )}
          {isAccomplished && (
            <form action={markGoalActive.bind(null, goal.id)}>
              <Button size="sm" variant="outline" type="submit">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reopen
              </Button>
            </form>
          )}
          {!isArchived(goal.status) && (
            <form action={archiveGoal.bind(null, goal.id)}>
              <Button size="sm" variant="ghost" type="submit" className="text-muted-foreground">
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </Button>
            </form>
          )}
          <form action={async () => {
            "use server"
            await deleteGoal(goal.id)
            redirect("/dashboard")
          }}>
            <Button size="sm" variant="ghost" type="submit" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </form>
        </div>
      </div>

      {/* YouTube embed */}
      {goal.youtubeUrl && (
        <>
          <Separator />
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reference</h2>
            <YouTubeEmbed url={goal.youtubeUrl} />
          </section>
        </>
      )}

      {/* Progress tracking */}
      {goal.goalType === "BPM" && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
            <ProjectionChart entries={goal.progressEntries} targetBpm={goal.targetBpm} splitHands={goal.splitHands} />
            <Metronome
              defaultBpm={
                goal.progressEntries.at(-1)?.bpm ??
                goal.targetBpm ??
                120
              }
            />
            <GoalDetailClient goal={goal} />
          </section>
        </>
      )}

      {goal.goalType === "OPEN" && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Session notes</h2>
            <GoalDetailClient goal={goal} />
          </section>
        </>
      )}

      {/* Attachments */}
      <Separator />
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Attachments</h2>
          <AttachmentUploader goalId={goal.id} />
        </div>
        <AttachmentList attachments={goal.attachments} goalId={goal.id} />
      </section>
    </div>
  )
}

function isArchived(status: string) {
  return status === "ARCHIVED"
}
