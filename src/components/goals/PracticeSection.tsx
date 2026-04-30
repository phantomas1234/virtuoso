"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Metronome } from "@/components/goals/Metronome"
import { DrumRecorder, type SessionStats } from "@/components/goals/DrumRecorder"
import { ProgressEntryForm } from "@/components/progress/ProgressEntryForm"
import type { GoalType, ProgressEntry } from "@prisma/client"

interface PracticeSectionProps {
  defaultBpm: number
  goalId: string
  goalType: GoalType
  splitHands?: boolean
  onEntryAdded: (entry: ProgressEntry, goalAccomplished: boolean) => void
}

export function PracticeSection({
  defaultBpm,
  goalId,
  goalType,
  splitHands,
  onEntryAdded,
}: PracticeSectionProps) {
  const [bpm, setBpm] = useState(defaultBpm)
  const [isPlaying, setIsPlaying] = useState(false)
  const [gridStartTime, setGridStartTime] = useState<number | null>(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [accuracyStats, setAccuracyStats] = useState<SessionStats | null>(null)

  const handleStart = useCallback((newBpm: number, perfTime: number) => {
    setBpm(newBpm)
    setGridStartTime(perfTime)
    setIsPlaying(true)
  }, [])

  const handleStop = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleSessionEnd = useCallback((stats: SessionStats) => {
    setAccuracyStats(stats)
  }, [])

  return (
    <div className="space-y-3">
      <Metronome
        defaultBpm={defaultBpm}
        onStart={handleStart}
        onStop={handleStop}
      />

      {/* Accuracy toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground text-xs"
        onClick={() => setShowRecorder(v => !v)}
      >
        {showRecorder ? (
          <><ChevronUp className="mr-1.5 h-3 w-3" /> Hide accuracy recorder</>
        ) : (
          <><ChevronDown className="mr-1.5 h-3 w-3" /> Show accuracy recorder</>
        )}
      </Button>

      {showRecorder && (
        <DrumRecorder
          bpm={bpm}
          isMetronomePlaying={isPlaying}
          gridStartTime={gridStartTime}
          onSessionEnd={handleSessionEnd}
        />
      )}

      <ProgressEntryForm
        goalId={goalId}
        goalType={goalType}
        splitHands={splitHands}
        accuracyStats={accuracyStats}
        onSuccess={onEntryAdded}
      />
    </div>
  )
}
