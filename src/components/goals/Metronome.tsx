"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Square, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MetronomeProps {
  defaultBpm?: number
}

export function Metronome({ defaultBpm = 120 }: MetronomeProps) {
  const [bpm, setBpm] = useState(Math.min(240, Math.max(40, defaultBpm)))
  const [isPlaying, setIsPlaying] = useState(false)
  const [flash, setFlash] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextBeatTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bpmRef = useRef(bpm)
  const isPlayingRef = useRef(false)
  const schedulerRef = useRef<(() => void) | null>(null)

  useEffect(() => { bpmRef.current = bpm }, [bpm])

  const scheduleClick = useCallback((time: number) => {
    const ctx = audioCtxRef.current!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1000
    gain.gain.setValueAtTime(0.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.start(time)
    osc.stop(time + 0.04)
  }, [])

  const scheduler = useCallback(() => {
    if (!isPlayingRef.current) return
    const ctx = audioCtxRef.current!
    while (nextBeatTimeRef.current < ctx.currentTime + 0.1) {
      scheduleClick(nextBeatTimeRef.current)
      const msUntilBeat = Math.max(0, (nextBeatTimeRef.current - ctx.currentTime) * 1000)
      setTimeout(() => {
        setFlash(true)
        setTimeout(() => setFlash(false), 80)
      }, msUntilBeat)
      nextBeatTimeRef.current += 60 / bpmRef.current
    }
    timerRef.current = setTimeout(() => schedulerRef.current?.(), 25)
  }, [scheduleClick])

  useEffect(() => { schedulerRef.current = scheduler }, [scheduler])

  const start = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === "suspended") ctx.resume()
    nextBeatTimeRef.current = ctx.currentTime
    isPlayingRef.current = true
    setIsPlaying(true)
    scheduler()
  }, [scheduler])

  const stop = useCallback(() => {
    isPlayingRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPlaying(false)
    setFlash(false)
  }, [])

  useEffect(() => () => { isPlayingRef.current = false; if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const clampedSet = (val: number) => setBpm(Math.min(240, Math.max(40, val)))

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Metronome</h3>
        <div
          className="h-3 w-3 rounded-full transition-colors duration-75"
          style={{ backgroundColor: flash ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
        />
      </div>

      {/* BPM display and controls */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => clampedSet(bpm - 10)}>
          <Minus className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => clampedSet(bpm - 1)}>
          <Minus className="h-3 w-3 opacity-50" />
        </Button>

        <div className="text-center w-24">
          <input
            type="number"
            min={40}
            max={240}
            value={bpm}
            onChange={e => clampedSet(Number(e.target.value))}
            className="w-full text-center text-3xl font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-xs text-muted-foreground">BPM</p>
        </div>

        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => clampedSet(bpm + 1)}>
          <Plus className="h-3 w-3 opacity-50" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => clampedSet(bpm + 10)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={40}
        max={240}
        value={bpm}
        onChange={e => clampedSet(Number(e.target.value))}
        className="w-full accent-primary"
      />

      {/* Play / Stop */}
      <Button
        className="w-full"
        variant={isPlaying ? "destructive" : "default"}
        onClick={isPlaying ? stop : start}
      >
        {isPlaying ? (
          <><Square className="mr-2 h-4 w-4" /> Stop</>
        ) : (
          <><Play className="mr-2 h-4 w-4" /> Start</>
        )}
      </Button>
    </div>
  )
}
