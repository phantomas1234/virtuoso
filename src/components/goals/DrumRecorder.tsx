"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Piano, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// ── Types ────────────────────────────────────────────────────────────────────

export type QuantMode =
  | "1/4" | "1/8" | "1/16" | "1/32"
  | "1/4T" | "1/8T" | "1/16T"
  | "1/8S" | "1/16S"
  | "1/8+T" | "1/16+T"

export interface SessionStats {
  avgDeviationMs: number
  deviationStdMs: number
  hitCount: number
}

interface DrumLane {
  note: number
  label: string
  color: string
  order: number
}

interface HitRecord {
  note: number
  deviationMs: number
  timestamp: number
}

interface GhHit {
  note: number
  deviationMs: number
  arrivedAt: number
}

interface DrumRecorderProps {
  bpm: number
  isMetronomePlaying: boolean
  gridStartTime: number | null
  onSessionEnd: (stats: SessionStats) => void
  onRequestStart?: () => void
  onRequestStop?: () => void
}

// ── GM drum map ───────────────────────────────────────────────────────────────

const GM_DRUMS: Record<number, { label: string; order: number }> = {
  35: { label: "Kick 2",     order: 0 },
  36: { label: "Kick",       order: 1 },
  37: { label: "Rim",        order: 2 },
  38: { label: "Snare",      order: 3 },
  39: { label: "Clap",       order: 4 },
  40: { label: "Snare 2",    order: 5 },
  41: { label: "Low Tom",    order: 6 },
  42: { label: "Hi-Hat",     order: 7 },
  43: { label: "High Tom",   order: 8 },
  44: { label: "Pedal HH",   order: 9 },
  45: { label: "Mid Tom",    order: 10 },
  46: { label: "Open HH",    order: 11 },
  47: { label: "Mid Tom 2",  order: 12 },
  48: { label: "Hi Tom 2",   order: 13 },
  49: { label: "Crash",      order: 14 },
  50: { label: "Hi Tom 3",   order: 15 },
  51: { label: "Ride",       order: 16 },
  52: { label: "China",      order: 17 },
  53: { label: "Ride Bell",  order: 18 },
  54: { label: "Tambourine", order: 19 },
  55: { label: "Splash",     order: 20 },
  56: { label: "Cowbell",    order: 21 },
  57: { label: "Crash 2",    order: 22 },
  59: { label: "Ride 2",     order: 23 },
}

const LANE_COLORS = [
  "#60a5fa", // blue
  "#f472b6", // pink
  "#34d399", // green
  "#fb923c", // orange
  "#a78bfa", // purple
  "#facc15", // yellow
  "#22d3ee", // cyan
  "#f87171", // red
]

// ── Quantization helpers ──────────────────────────────────────────────────────

function subdivMs(mode: QuantMode, bpm: number): number {
  const beat = 60000 / bpm
  switch (mode) {
    case "1/4":   return beat
    case "1/8":   return beat / 2
    case "1/16":  return beat / 4
    case "1/32":  return beat / 8
    case "1/4T":  return (beat * 2) / 3
    case "1/8T":  return beat / 3
    case "1/16T": return beat / 6
    case "1/8S":  return beat / 2
    case "1/16S": return beat / 4
    case "1/8+T": return beat / 2   // primary grid for canvas scroll
    case "1/16+T": return beat / 4
  }
}

function nearestOnGrid(elapsed: number, sub: number): number {
  return Math.round(elapsed / sub) * sub
}

function calcDeviation(
  hitTime: number,
  gridStart: number,
  mode: QuantMode,
  bpm: number,
  swingRatio: number,
): number {
  const elapsed = hitTime - gridStart
  const beat = 60000 / bpm

  // Nearest-grid modes: snap to whichever of two grids is closer
  if (mode === "1/8+T") {
    const dev8  = elapsed - nearestOnGrid(elapsed, beat / 2)
    const devT  = elapsed - nearestOnGrid(elapsed, beat / 3)
    return Math.abs(dev8) <= Math.abs(devT) ? dev8 : devT
  }
  if (mode === "1/16+T") {
    const dev16 = elapsed - nearestOnGrid(elapsed, beat / 4)
    const devT  = elapsed - nearestOnGrid(elapsed, beat / 6)
    return Math.abs(dev16) <= Math.abs(devT) ? dev16 : devT
  }

  const sub = subdivMs(mode, bpm)

  if (mode === "1/8S" || mode === "1/16S") {
    const pairMs = sub * 2
    const pairIdx = Math.floor(elapsed / pairMs)
    const pos = elapsed - pairIdx * pairMs
    const onDist = Math.abs(pos)
    const offDist = Math.abs(pos - swingRatio * pairMs)
    const nearest = pairIdx * pairMs + (onDist <= offDist ? 0 : swingRatio * pairMs)
    return elapsed - nearest
  }

  const nearest = Math.round(elapsed / sub) * sub
  return elapsed - nearest
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function deviationColor(absMs: number): string {
  if (absMs < 20) return "#22c55e"
  if (absMs < 40) return "#f59e0b"
  return "#ef4444"
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const CANVAS_W = 500
const LABEL_W = 72
const LANE_H = 16
const LANE_GAP = 4
const TOP_PAD = 8
const BOT_PAD = 8
const HIT_ZONE_X = CANVAS_W - 50
const SCROLL_PX_PER_MS = 0.12
const HIT_FADE_MS = 2500

function canvasH(numLanes: number): number {
  const n = Math.max(1, numLanes)
  return TOP_PAD + n * LANE_H + (n - 1) * LANE_GAP + BOT_PAD
}

function laneTop(idx: number): number {
  return TOP_PAD + idx * (LANE_H + LANE_GAP)
}

// ── Canvas draw ───────────────────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  now: number,
  ghHits: GhHit[],
  lanes: DrumLane[],
  bpm: number,
  mode: QuantMode,
  gridStart: number | null,
) {
  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = "#0f0f14"
  ctx.fillRect(0, 0, cw, ch)

  if (lanes.length === 0) {
    ctx.fillStyle = "rgba(148,148,184,0.3)"
    ctx.font = "11px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("Play any drum pad to create a lane", cw / 2, ch / 2)
    return
  }

  const totalBottom = ch - BOT_PAD

  // Lane backgrounds + labels
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i]
    const y = laneTop(i)

    // Timeline background
    ctx.fillStyle = "#1a1a26"
    ctx.fillRect(LABEL_W, y, cw - LABEL_W, LANE_H)

    // Lane border lines
    ctx.strokeStyle = "#333355"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LABEL_W, y); ctx.lineTo(cw, y)
    ctx.moveTo(LABEL_W, y + LANE_H); ctx.lineTo(cw, y + LANE_H)
    ctx.stroke()

    // Label column background
    ctx.fillStyle = "#12121c"
    ctx.fillRect(0, y, LABEL_W, LANE_H)

    // Color dot
    ctx.fillStyle = lane.color
    ctx.beginPath()
    ctx.arc(10, y + LANE_H / 2, 4, 0, Math.PI * 2)
    ctx.fill()

    // Label text
    ctx.fillStyle = "#9494b8"
    ctx.font = "10px system-ui, sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(lane.label, 20, y + LANE_H / 2)
  }

  // Vertical separator between label column and timeline
  ctx.strokeStyle = "#333355"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LABEL_W, TOP_PAD)
  ctx.lineTo(LABEL_W, totalBottom)
  ctx.stroke()

  // Subdivision lines (timeline area only, scroll left)
  if (gridStart !== null) {
    const sub = subdivMs(mode, bpm)
    const elapsed = now - gridStart
    const offsetPx = (elapsed % sub) * SCROLL_PX_PER_MS
    let x = HIT_ZONE_X - offsetPx
    while (x > LABEL_W) {
      ctx.strokeStyle = "rgba(100,100,180,0.35)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, TOP_PAD); ctx.lineTo(x, totalBottom)
      ctx.stroke()
      ctx.setLineDash([])
      x -= sub * SCROLL_PX_PER_MS
    }
  }

  // Hit zone line (spans all lanes)
  ctx.strokeStyle = "rgba(255,255,255,0.5)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(HIT_ZONE_X, TOP_PAD - 4)
  ctx.lineTo(HIT_ZONE_X, totalBottom + 4)
  ctx.stroke()

  // Hits per lane
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i]
    const y = laneTop(i)
    const centerY = y + LANE_H / 2

    for (const hit of ghHits) {
      if (hit.note !== lane.note) continue
      const age = now - hit.arrivedAt
      if (age > HIT_FADE_MS) continue
      const alpha = Math.max(0, 1 - age / HIT_FADE_MS)

      const actualX = HIT_ZONE_X - age * SCROLL_PX_PER_MS
      const quantX = actualX - hit.deviationMs * SCROLL_PX_PER_MS
      if (actualX < LABEL_W - 20 && quantX < LABEL_W - 20) continue

      const color = deviationColor(Math.abs(hit.deviationMs))
      const isAccurate = Math.abs(hit.deviationMs) < 20

      // Error fill between beat and actual hit
      const fillL = Math.max(LABEL_W, Math.min(actualX, quantX))
      const fillR = Math.max(LABEL_W, Math.max(actualX, quantX))
      ctx.globalAlpha = alpha * 0.35
      ctx.fillStyle = color
      ctx.fillRect(fillL, y, Math.max(2, fillR - fillL), LANE_H)
      ctx.globalAlpha = 1

      // Quantized beat line (white)
      if (quantX >= LABEL_W) {
        ctx.globalAlpha = alpha * 0.7
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(quantX, y); ctx.lineTo(quantX, y + LANE_H)
        ctx.stroke()
      }

      // Actual hit line (lane color tinted by accuracy)
      if (actualX >= LABEL_W) {
        ctx.globalAlpha = alpha
        ctx.strokeStyle = color
        ctx.lineWidth = isAccurate ? 3 : 2
        ctx.beginPath()
        ctx.moveTo(actualX, y); ctx.lineTo(actualX, y + LANE_H)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Sparkle for accurate hits
      if (isAccurate && age < 700 && actualX >= LABEL_W) {
        const progress = age / 700
        const burstAlpha = Math.pow(1 - progress, 1.5)

        if (age < 250) {
          const glowAlpha = ((250 - age) / 250) * 0.6
          const grad = ctx.createLinearGradient(actualX - 10, 0, actualX + 10, 0)
          grad.addColorStop(0, "transparent")
          grad.addColorStop(0.5, lane.color)
          grad.addColorStop(1, "transparent")
          ctx.globalAlpha = glowAlpha
          ctx.fillStyle = grad
          ctx.fillRect(actualX - 10, y, 20, LANE_H)
          ctx.globalAlpha = 1
        }

        const seed = hit.arrivedAt % 1000
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2 + seed * 0.006
          const dist = progress * 6
          const px = actualX + Math.cos(angle) * dist
          const py = centerY + Math.sin(angle) * dist
          if (px < LABEL_W) continue
          ctx.globalAlpha = burstAlpha
          ctx.fillStyle = j % 2 === 0 ? lane.color : "#ffffff"
          ctx.beginPath()
          ctx.arc(px, py, 1.5 * (1 - progress), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    }
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function DrumRecorder({ bpm, isMetronomePlaying, gridStartTime, onSessionEnd, onRequestStart, onRequestStop }: DrumRecorderProps) {
  const [quantMode, setQuantMode] = useState<QuantMode>("1/8")
  const [swingRatio, setSwingRatio] = useState(0.625)
  const [latencyMs, setLatencyMs] = useState(() => {
    // Best-effort initialisation from browser-reported audio output latency.
    // Chrome on macOS often under-reports, so this may still need manual tuning.
    try {
      const ctx = new AudioContext()
      const ms = Math.round(((ctx.outputLatency ?? 0) + (ctx.baseLatency ?? 0)) * 1000)
      ctx.close()
      return ms
    } catch {
      return 0
    }
  })
  const [isRecording, setIsRecording] = useState(false)
  const [hits, setHits] = useState<HitRecord[]>([])
  const [lanes, setLanes] = useState<DrumLane[]>([])

  // Refs for values read inside animation loop / callbacks without stale closures
  const lanesRef = useRef<DrumLane[]>([])
  const ghHitsRef = useRef<GhHit[]>([])
  const allHitsRef = useRef<GhHit[]>([])   // full unfiltered history for scrollback
  const animFrameRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollLabelRef = useRef<HTMLSpanElement>(null)
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const isRecordingRef = useRef(false)
  const freezeTimeRef = useRef<number | null>(null)  // set when recording stops
  const viewOffsetRef = useRef(0)                    // ms scrolled back from freeze point

  const gridStartRef = useRef(gridStartTime)
  const quantModeRef = useRef(quantMode)
  const bpmRef = useRef(bpm)
  const swingRef = useRef(swingRatio)
  const latencyRef = useRef(latencyMs)
  useEffect(() => { gridStartRef.current = gridStartTime }, [gridStartTime])
  useEffect(() => { quantModeRef.current = quantMode }, [quantMode])
  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { swingRef.current = swingRatio }, [swingRatio])
  useEffect(() => { latencyRef.current = latencyMs }, [latencyMs])

  // ── Canvas animation loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!

    // Wheel handler — only active when frozen; scroll back/forward through history
    const onWheel = (e: WheelEvent) => {
      if (freezeTimeRef.current === null) return
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaX * 16 || e.deltaY * 16  // line mode
                                      : e.deltaX || e.deltaY             // pixel mode
      const maxOffset = freezeTimeRef.current - (ghHitsRef.current[0]?.arrivedAt ?? freezeTimeRef.current)
      viewOffsetRef.current = Math.max(0, Math.min(maxOffset, viewOffsetRef.current + delta * 10))
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })

    let running = true
    function frame() {
      if (!running) return
      const now = performance.now()
      const frozen = freezeTimeRef.current !== null
      const renderNow = frozen ? freezeTimeRef.current! - viewOffsetRef.current : now

      // Only trim live hits; keep all hits for history navigation
      if (!frozen) {
        ghHitsRef.current = ghHitsRef.current.filter(h => now - h.arrivedAt < HIT_FADE_MS + 200)
      }

      const adjustedStart = gridStartRef.current !== null
        ? gridStartRef.current + latencyRef.current
        : null
      drawGrid(ctx, canvas.width, canvas.height, renderNow, ghHitsRef.current, lanesRef.current, bpmRef.current, quantModeRef.current, adjustedStart)

      // Scroll label
      if (scrollLabelRef.current) {
        if (frozen && viewOffsetRef.current > 0) {
          scrollLabelRef.current.textContent = `−${(viewOffsetRef.current / 1000).toFixed(1)} s`
          scrollLabelRef.current.style.opacity = "1"
        } else {
          scrollLabelRef.current.style.opacity = "0"
        }
      }

      animFrameRef.current = requestAnimationFrame(frame)
    }
    animFrameRef.current = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
      canvas.removeEventListener("wheel", onWheel)
    }
  }, [])

  // ── MIDI ─────────────────────────────────────────────────────────────────────

  const handleNoteOn = useCallback((note: number, hitTime: number) => {
    // Register new lane on first hit for this note (always, even before recording)
    if (!lanesRef.current.find(l => l.note === note)) {
      const gmInfo = GM_DRUMS[note]
      const newLane: DrumLane = {
        note,
        label: gmInfo?.label ?? `Note ${note}`,
        color: LANE_COLORS[lanesRef.current.length % LANE_COLORS.length],
        order: gmInfo?.order ?? 1000 + note,
      }
      const sorted = [...lanesRef.current, newLane].sort((a, b) => a.order - b.order)
      lanesRef.current = sorted
      setLanes(sorted)
    }

    // Only record deviation hits while recording is active and grid is running
    if (!isRecordingRef.current || !gridStartRef.current) return
    const adjustedStart = gridStartRef.current + latencyRef.current
    const dev = calcDeviation(hitTime, adjustedStart, quantModeRef.current, bpmRef.current, swingRef.current)
    const ghHit = { note, deviationMs: dev, arrivedAt: performance.now() }
    setHits(prev => [...prev, { note, deviationMs: dev, timestamp: hitTime }])
    ghHitsRef.current = [...ghHitsRef.current, ghHit]
    allHitsRef.current = [...allHitsRef.current, ghHit]
  }, [])

  const attachMidiHandler = useCallback((input: MIDIInput) => {
    input.onmidimessage = (e: MIDIMessageEvent) => {
      if (!e.data) return
      const [status, note, velocity] = Array.from(e.data)
      if ((status & 0xf0) !== 0x90 || velocity === 0) return
      handleNoteOn(note, e.timeStamp)
    }
  }, [handleNoteOn])

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return
    let active = true
    navigator.requestMIDIAccess().then(access => {
      if (!active) return
      midiAccessRef.current = access
      for (const input of access.inputs.values()) attachMidiHandler(input)
      access.onstatechange = () => {
        for (const input of access.inputs.values()) {
          if (!input.onmidimessage) attachMidiHandler(input)
        }
      }
    }).catch(() => {})
    return () => {
      active = false
      if (midiAccessRef.current) {
        for (const input of midiAccessRef.current.inputs.values()) {
          input.onmidimessage = null
        }
      }
    }
  }, [attachMidiHandler])

  const startRecording = useCallback(() => {
    setHits([])
    ghHitsRef.current = []
    allHitsRef.current = []
    freezeTimeRef.current = null
    viewOffsetRef.current = 0
    isRecordingRef.current = true
    setIsRecording(true)
    onRequestStart?.()
  }, [onRequestStart])

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    freezeTimeRef.current = performance.now()
    viewOffsetRef.current = 0
    ghHitsRef.current = [...allHitsRef.current]  // restore full history for scrollback
    setIsRecording(false)
    onRequestStop?.()
    setHits(prev => {
      if (prev.length === 0) return prev
      const devs = prev.map(h => h.deviationMs)
      const avg = devs.reduce((a, b) => a + b, 0) / devs.length
      const std = Math.sqrt(devs.reduce((a, b) => a + (b - avg) ** 2, 0) / devs.length)
      onSessionEnd({ avgDeviationMs: avg, deviationStdMs: std, hitCount: devs.length })
      return prev
    })
  }, [onSessionEnd, onRequestStop])

  useEffect(() => {
    if (!isMetronomePlaying && isRecording) {
      const id = setTimeout(stopRecording, 0)
      return () => clearTimeout(id)
    }
  }, [isMetronomePlaying, isRecording, stopRecording])

  // ── Derived stats ─────────────────────────────────────────────────────────────

  const isSwing = quantMode === "1/8S" || quantMode === "1/16S"

  const laneStats = lanes.map(lane => {
    const laneHits = hits.filter(h => h.note === lane.note)
    if (laneHits.length === 0) return { lane, avg: null, std: null, count: 0 }
    const devs = laneHits.map(h => h.deviationMs)
    const avg = devs.reduce((a, b) => a + b, 0) / devs.length
    const std = devs.length > 1
      ? Math.sqrt(devs.reduce((a, b) => a + (b - avg) ** 2, 0) / devs.length)
      : 0
    return { lane, avg, std, count: devs.length }
  })

  const aggregateAvg = hits.length > 0
    ? hits.reduce((a, h) => a + h.deviationMs, 0) / hits.length
    : null
  const aggregateStd = hits.length > 1 && aggregateAvg !== null
    ? Math.sqrt(hits.reduce((a, h) => a + (h.deviationMs - aggregateAvg!) ** 2, 0) / hits.length)
    : null

  const cvH = canvasH(lanes.length)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Piano className="h-4 w-4" /> Accuracy Recorder
      </h3>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Quantize</Label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={quantMode}
            onChange={e => setQuantMode(e.target.value as QuantMode)}
          >
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
            <option value="1/32">1/32</option>
            <option value="1/4T">1/4 Triplet</option>
            <option value="1/8T">1/8 Triplet</option>
            <option value="1/16T">1/16 Triplet</option>
            <option value="1/8S">1/8 Swing</option>
            <option value="1/16S">1/16 Swing</option>
            <option value="1/8+T">1/8 + Triplet</option>
            <option value="1/16+T">1/16 + Triplet</option>
          </select>
        </div>

        {isSwing && (
          <div className="space-y-1">
            <Label className="text-xs">Swing {Math.round(swingRatio * 100)}%</Label>
            <input
              type="range" min={50} max={75} step={1}
              value={Math.round(swingRatio * 100)}
              onChange={e => setSwingRatio(Number(e.target.value) / 100)}
              className="w-24 accent-primary"
            />
          </div>
        )}

        <Button
          size="sm"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? stopRecording : startRecording}
          className="ml-auto"
        >
          {isRecording
            ? <><Square className="mr-1.5 h-3.5 w-3.5" /> Stop</>
            : <><Play className="mr-1.5 h-3.5 w-3.5" /> Record</>}
        </Button>
      </div>

      {/* Latency offset */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Latency offset</Label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={200}
              value={latencyMs}
              onChange={e => setLatencyMs(Math.max(0, Math.min(200, Number(e.target.value))))}
              className="w-16 h-6 rounded border border-input bg-background px-2 text-xs text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-muted-foreground">ms</span>
          </div>
        </div>
        <div className="relative">
          <input
            type="range" min={0} max={200} step={1}
            value={latencyMs}
            onChange={e => setLatencyMs(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground/50 tabular-nums mt-0.5 pointer-events-none select-none">
            <span>0</span>
            <span>200 ms</span>
          </div>
        </div>
      </div>

      {/* Timeline canvas — height grows as new lanes appear */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={cvH}
          className="rounded-md block"
          style={{ width: "100%", height: "auto", cursor: isRecording ? "default" : "ew-resize" }}
        />
        <span
          ref={scrollLabelRef}
          className="absolute top-1 right-2 text-xs font-mono text-muted-foreground/60 pointer-events-none transition-opacity duration-150"
          style={{ opacity: 0 }}
        />
      </div>

      {/* Per-lane stats + aggregate */}
      {hits.length > 0 && (
        <div className="space-y-1 text-xs font-mono">
          {laneStats.map(({ lane, avg, std, count }) =>
            avg !== null ? (
              <div key={lane.note} className="flex items-center gap-3 text-muted-foreground">
                <span className="w-16 truncate font-medium" style={{ color: lane.color }}>
                  {lane.label}
                </span>
                <span>
                  avg{" "}
                  <span style={{ color: deviationColor(Math.abs(avg)) }}>
                    {avg >= 0 ? "+" : ""}{avg.toFixed(1)} ms
                  </span>
                </span>
                {std !== null && <span>±{std.toFixed(1)} ms</span>}
                <span>{count} hits</span>
              </div>
            ) : null
          )}
          {aggregateAvg !== null && lanes.length > 1 && (
            <div className="flex items-center gap-3 text-muted-foreground border-t border-border/40 pt-1 mt-1">
              <span className="w-16 font-medium text-muted-foreground/60">Total</span>
              <span>
                avg{" "}
                <span style={{ color: deviationColor(Math.abs(aggregateAvg)) }}>
                  {aggregateAvg >= 0 ? "+" : ""}{aggregateAvg.toFixed(1)} ms
                </span>
              </span>
              {aggregateStd !== null && <span>±{aggregateStd.toFixed(1)} ms</span>}
              <span>{hits.length} hits</span>
            </div>
          )}
        </div>
      )}

      {/* Test pads */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground/50">Test pads</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { note: 36, label: "Kick" },
            { note: 38, label: "Snare" },
            { note: 42, label: "HH" },
            { note: 46, label: "Open HH" },
            { note: 41, label: "Lo Tom" },
            { note: 45, label: "Mid Tom" },
            { note: 43, label: "Hi Tom" },
            { note: 49, label: "Crash" },
          ] as const).map(({ note, label }) => (
            <button
              key={note}
              onPointerDown={() => handleNoteOn(note, performance.now())}
              className="px-2.5 py-1 rounded text-xs border border-input bg-muted hover:bg-muted/70 active:scale-95 select-none transition-transform"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
