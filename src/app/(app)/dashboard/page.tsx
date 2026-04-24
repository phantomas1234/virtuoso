import Link from "next/link"
import { Plus } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GoalList } from "@/components/goals/GoalList"
import { EmptyState } from "@/components/shared/EmptyState"
import type { GoalStatus } from "@prisma/client"

async function getGoals(userId: string, status?: GoalStatus) {
  return prisma.goal.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { position: "asc" },
    include: {
      _count: { select: { progressEntries: true, attachments: true } },
      progressEntries: { select: { bpm: true, hand: true }, orderBy: { date: "desc" }, take: 10 },
    },
  })
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id

  const [allGoals, activeGoals, accomplishedGoals, archivedGoals] = await Promise.all([
    getGoals(userId),
    getGoals(userId, "ACTIVE"),
    getGoals(userId, "ACCOMPLISHED"),
    getGoals(userId, "ARCHIVED"),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground text-sm">
            {activeGoals.length} active · {accomplishedGoals.length} accomplished
          </p>
        </div>
        <Button asChild>
          <Link href="/goals/new">
            <Plus className="mr-2 h-4 w-4" />
            New goal
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeGoals.length})</TabsTrigger>
          <TabsTrigger value="accomplished">Done ({accomplishedGoals.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedGoals.length})</TabsTrigger>
          <TabsTrigger value="all">All ({allGoals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeGoals.length === 0 ? (
            <EmptyState
              title="No active goals yet"
              description="Set your first practice goal and start tracking your musical progress."
              action={{ label: "Create your first goal", href: "/goals/new" }}
            />
          ) : (
            <GoalList initialGoals={activeGoals} />
          )}
        </TabsContent>

        <TabsContent value="accomplished" className="mt-4">
          {accomplishedGoals.length === 0 ? (
            <EmptyState
              title="No accomplished goals yet"
              description="Keep practicing — your first accomplishment is just around the corner!"
            />
          ) : (
            <GoalList initialGoals={accomplishedGoals} />
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {archivedGoals.length === 0 ? (
            <EmptyState
              title="No archived goals"
              description="Goals you archive will appear here."
            />
          ) : (
            <GoalList initialGoals={archivedGoals} />
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {allGoals.length === 0 ? (
            <EmptyState
              title="No goals yet"
              description="Create your first goal to get started."
              action={{ label: "Create a goal", href: "/goals/new" }}
            />
          ) : (
            <GoalList initialGoals={allGoals} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
