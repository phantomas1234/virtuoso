"use client"

import { useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { GoalCard } from "./GoalCard"
import type { GoalWithCounts } from "@/types"

function SortableGoalCard({ goal }: { goal: GoalWithCounts }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <GoalCard
        goal={goal}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
        isDragging={isDragging}
      />
    </div>
  )
}

interface GoalListProps {
  initialGoals: GoalWithCounts[]
}

export function GoalList({ initialGoals }: GoalListProps) {
  const [goals, setGoals] = useState(initialGoals)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = goals.findIndex((g) => g.id === active.id)
      const newIndex = goals.findIndex((g) => g.id === over.id)
      const reordered = arrayMove(goals, oldIndex, newIndex)

      setGoals(reordered) // optimistic update

      try {
        const res = await fetch("/api/goals/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reordered.map((g) => g.id) }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setGoals(goals) // revert on error
        toast.error("Failed to save order. Please try again.")
      }
    },
    [goals]
  )

  if (goals.length === 0) return null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {goals.map((goal) => (
            <SortableGoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
