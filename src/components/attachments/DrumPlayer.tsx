"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Square, Minus, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DrumScoreData } from "@/app/api/goals/[goalId]/attachments/[attachmentId]/parse-drums/route"

// GM drum midi → sample file
const MIDI_TO_SAMPLE: Record<number, string> = {
  35: "kick", 36: "kick",
  38: "snare", 40: "snare",
  37: "rimshot",
  42: "hihat_closed", 44: "hihat_closed",
  46: "hihat_open",
  49: "crash", 57: "crash",
  51: "ride", 59: "ride", 53: "ride",
  41: "tom_low", 43: "tom_low",
  45: "tom_mid", 47: "tom_mid",
  48: "tom_high", 50: "tom_high",
}

const SAMPLE_NAMES = [
  "kick", "snare", "rimshot",
  "hihat_closed", "hihat_open",
  "crash", "ride",
  "tom_high", "tom_mid", "tom_low",
]

interface DrumPlayerProps {
  score: DrumScoreData
  suggestedBpm?: number | null
}

export function DrumPlayer({ score, suggestedBpm }: DrumPlayerProps) {
  const defaultBpm = suggestedBpm ?? score.header.suggestedBpm ?? 120
  const [bpm, setBpm] = useState(Math.min(240, Math.max(20, defaultBpm)))
  const [isPlaying, setIsPlaying] = useState(false)
  const [samplesReady, setSamplesReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentTick, setCurrentTick] = useState(-1)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const samplesRef = useRef<Record<string, AudioBuffer>>({})
  const nextNoteTimeRef = useRef(0)
  const currentNoteIndexRef = useRef(0)
  const bpmRef = useRef(bpm)
  const isPlayingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulerRef = useRef<(() => void) | null>(null)

  // Flatten all notes from all tracks, sorted by time
  const allNotes = useRef<Array<{ time: number; midi: number; velocity: number }>>([])
  useEffect(() => {
    const notes = score.tracks.flatMap((t) => t.notes).sort((a, b) => a.time - b.time)
    allNotes.current = notes
  }, [score])

  const totalTicks = useRef(0)
  useEffect(() => {
    if (allNotes.current.length > 0) {
      const last = allNotes.current[allNotes.current.length - 1]
      const ppq = score.header.ppq
      const [num, den] = score.header.timeSignature
      const ticksPerMeasure = ppq * 4 * (num / den)
      // round up to next measure boundary
      totalTicks.current = Math.ceil((last.time + 1) / ticksPerMeasure) * ticksPerMeasure
    }
  }, [score])

  useEffect(() => { bpmRef.current = bpm }, [bpm])

  const tickToSeconds = useCallback(
    (tick: number) => (tick / score.header.ppq) * (60 / bpmRef.current),
    [score.header.ppq]
  )

  // Load all samples once
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const entries = await Promise.all(
          SAMPLE_NAMES.map(async (name) => {
            const res = await fetch(`/samples/drums/${name}.wav`)
            if (!res.ok) throw new Error(`Failed to load ${name}.wav`)
            const buf = await res.arrayBuffer()
            const decoded = await ctx.decodeAudioData(buf)
            return [name, decoded] as const
          })
        )
        if (!cancelled) {
          samplesRef.current = Object.fromEntries(entries)
          setSamplesReady(true)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load samples")
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fireNote = useCallback((midi: number, velocity: number, when: number) => {
    const name = MIDI_TO_SAMPLE[midi]
    const buf = name ? samplesRef.current[name] : undefined
    if (!buf || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.value = velocity / 127
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(when)
  }, [])

  const scheduler = useCallback(() => {
    if (!isPlayingRef.current || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const lookAhead = 0.1 // seconds

    while (true) {
      const idx = currentNoteIndexRef.current
      const notes = allNotes.current
      const total = totalTicks.current

      if (notes.length === 0) break

      const noteTime = nextNoteTimeRef.current
      if (noteTime > ctx.currentTime + lookAhead) break

      if (idx < notes.length) {
        const note = notes[idx]
        fireNote(note.midi, note.velocity, noteTime)

        const msUntil = Math.max(0, (noteTime - ctx.currentTime) * 1000)
        setTimeout(() => setCurrentTick(note.time % total), msUntil)

        // Advance to next note
        currentNoteIndexRef.current = idx + 1

        if (idx + 1 < notes.length) {
          const gap = notes[idx + 1].time - note.time
          nextNoteTimeRef.current += tickToSeconds(gap)
        } else {
          // End of piece — loop: schedule silence until bar end then restart
          const remaining = total - note.time
          nextNoteTimeRef.current += tickToSeconds(remaining)
          currentNoteIndexRef.current = 0
          // offset next iteration's note times from loop start
        }
      } else {
        // wrapped — restart from note 0
        currentNoteIndexRef.current = 0
      }
    }

    timerRef.current = setTimeout(() => schedulerRef.current?.(), 25)
  }, [fireNote, tickToSeconds])

  useEffect(() => { schedulerRef.current = scheduler }, [scheduler])

  const start = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.state === "suspended") ctx.resume()

    currentNoteIndexRef.current = 0
    const notes = allNotes.current
    nextNoteTimeRef.current =
      ctx.currentTime + (notes.length > 0 ? 0 : 0)

    isPlayingRef.current = true
    setIsPlaying(true)
    scheduler()
  }, [scheduler])

  const stop = useCallback(() => {
    isPlayingRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPlaying(false)
    setCurrentTick(-1)
  }, [])

  useEffect(() => () => {
    isPlayingRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const clamp = (v: number) => Math.min(240, Math.max(20, v))

  const notes = allNotes.current
  const total = totalTicks.current
  const ppq = score.header.ppq
  const [num] = score.header.timeSignature
  const ticksPerBeat = ppq
  const totalBeats = total / ticksPerBeat

  if (loadError) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
        Failed to load drum samples: {loadError}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Drum Player
          {score.header.name ? ` — ${score.header.name}` : ""}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{num}/4</span>
          <span>·</span>
          <span>{notes.length} hits</span>
        </div>
      </div>

      {/* Beat grid */}
      {totalBeats > 0 && totalBeats <= 128 && (
        <div className="flex flex-wrap gap-0.5">
          {Array.from({ length: Math.ceil(totalBeats) }).map((_, i) => {
            const beatTick = i * ticksPerBeat
            const isActive =
              currentTick >= beatTick && currentTick < beatTick + ticksPerBeat
            const hasMeasureBoundary = i % num === 0
            return (
              <div
                key={i}
                className={[
                  "h-4 rounded-sm transition-colors duration-75",
                  hasMeasureBoundary ? "w-4" : "w-3",
                  isActive
                    ? "bg-primary"
                    : hasMeasureBoundary
                    ? "bg-muted-foreground/40"
                    : "bg-muted",
                ].join(" ")}
              />
            )
          })}
        </div>
      )}

      {/* BPM controls */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBpm((v) => clamp(v - 10))}>
          <Minus className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBpm((v) => clamp(v - 1))}>
          <Minus className="h-3 w-3 opacity-50" />
        </Button>
        <div className="text-center w-24">
          <input
            type="number"
            min={20}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(clamp(Number(e.target.value)))}
            className="w-full text-center text-3xl font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-xs text-muted-foreground">BPM</p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBpm((v) => clamp(v + 1))}>
          <Plus className="h-3 w-3 opacity-50" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBpm((v) => clamp(v + 10))}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <input
        type="range"
        min={20}
        max={240}
        value={bpm}
        onChange={(e) => setBpm(clamp(Number(e.target.value)))}
        className="w-full accent-primary"
      />

      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={isPlaying ? "destructive" : "default"}
          disabled={!samplesReady}
          onClick={isPlaying ? stop : start}
        >
          {!samplesReady ? (
            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading samples…</>
          ) : isPlaying ? (
            <><Square className="mr-2 h-4 w-4" /> Stop</>
          ) : (
            <><Play className="mr-2 h-4 w-4" /> Play</>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={!samplesReady}
          title="Reset to suggested BPM"
          onClick={() => setBpm(clamp(defaultBpm))}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
