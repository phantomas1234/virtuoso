"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Trash2, Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { GoalType } from "@prisma/client"

type ProgressEntry = {
  id: string
  goalId: string
  bpm: number | null
  note: string | null
  date: Date
  createdAt: Date
  hand?: "LEFT" | "RIGHT" | null
}

const HAND_LABELS: Record<string, string> = { LEFT: "Left", RIGHT: "Right" }

interface ProgressHistoryProps {
  entries: ProgressEntry[]
  goalId: string
  goalType: GoalType
  splitHands?: boolean
}

interface EditState {
  bpm: string
  note: string
  date: string
}

export function ProgressHistory({ entries, goalId, goalType, splitHands }: ProgressHistoryProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ bpm: "", note: "", date: "" })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (entries.length === 0) return null

  const startEdit = (entry: ProgressEntry) => {
    setEditingId(entry.id)
    setEditState({
      bpm: entry.bpm?.toString() ?? "",
      note: entry.note ?? "",
      date: format(new Date(entry.date), "yyyy-MM-dd"),
    })
  }

  const saveEdit = async (entryId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/progress/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bpm: editState.bpm ? parseInt(editState.bpm) : undefined,
          note: editState.note || null,
          date: editState.date,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Entry updated")
      setEditingId(null)
      router.refresh()
    } catch {
      toast.error("Failed to update entry")
    }
  }

  const deleteEntry = async (entryId: string) => {
    setDeletingId(entryId)
    try {
      const res = await fetch(`/api/goals/${goalId}/progress/${entryId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Entry deleted")
      router.refresh()
    } catch {
      toast.error("Failed to delete entry")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            {goalType === "BPM" && <th className="px-4 py-2 text-left font-medium font-mono">BPM</th>}
            {splitHands && <th className="px-4 py-2 text-left font-medium">Hand</th>}
            <th className="px-4 py-2 text-left font-medium">Notes</th>
            <th className="px-4 py-2 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...entries].reverse().map((entry) => (
            <tr key={entry.id} className="hover:bg-muted/30">
              {editingId === entry.id ? (
                <>
                  <td className="px-4 py-2">
                    <Input
                      type="date"
                      value={editState.date}
                      onChange={(e) => setEditState((s) => ({ ...s, date: e.target.value }))}
                      className="h-7 text-xs w-32"
                    />
                  </td>
                  {goalType === "BPM" && (
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={editState.bpm}
                        onChange={(e) => setEditState((s) => ({ ...s, bpm: e.target.value }))}
                        className="h-7 text-xs font-mono w-20"
                        min={1}
                        max={999}
                      />
                    </td>
                  )}
                  {splitHands && (
                    <td className="px-4 py-2 text-muted-foreground">
                      {entry.hand ? HAND_LABELS[entry.hand] : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <Textarea
                      value={editState.note}
                      onChange={(e) => setEditState((s) => ({ ...s, note: e.target.value }))}
                      className="min-h-0 h-7 text-xs py-1 resize-none"
                      rows={1}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(entry.id)}>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {format(new Date(entry.date), "MMM d, yyyy")}
                  </td>
                  {goalType === "BPM" && (
                    <td className="px-4 py-2 font-mono font-medium">{entry.bpm ?? "—"}</td>
                  )}
                  {splitHands && (
                    <td className="px-4 py-2 text-muted-foreground">
                      {entry.hand ? HAND_LABELS[entry.hand] : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2 text-muted-foreground">{entry.note ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(entry)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deletingId === entry.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
