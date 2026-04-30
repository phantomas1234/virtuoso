"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, Piano, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// ── Types ────────────────────────────────────────────────────────────────────

export type QuantMode =
  | "1/4" | "1/8" | "1/16" | "1/32"
  | "1/4T" | "1/8T" | "1/16T"
  | "1/8S" | "1/16S"

export interface SessionStats {
  avgDeviationMs: number
  deviationStdMs: number
  hitCount: number
}

interface HitRecord {
  deviationMs: number  // negative = early, positive = late
  timestamp: number    // performance.now()
}

interface DrumRecorderProps {
  bpm: number
  isMetronomePlaying: boolean
  gridStartTime: number | null
  onSessionEnd: (stats: SessionStats) => void
}

// ── Quantization helpers ─────────────────────────────────────────────────────

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
  }
}

function calcDeviation(
  hitTime: number,
  gridStart: number,
  mode: QuantMode,
  bpm: number,
  swingRatio: number,
): number {
  const elapsed = hitTime - gridStart
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
  if (absMs < 15) return "#22c55e"   // green-500
  if (absMs < 30) return "#f59e0b"   // amber-500
  return "#ef4444"                    // red-500
}

// ── Guitar Hero Canvas ────────────────────────────────────────────────────────

const CANVAS_W = 320
const CANVAS_H = 200
const LANE_W = 40
const HIT_ZONE_Y = CANVAS_H - 30
const SCROLL_PX_PER_MS = 0.12  // how fast subdivision lines scroll upward
const HIT_FADE_MS = 2500        // how long a hit stays visible

interface GhHit {
  deviationMs: number
  arrivedAt: number  // performance.now() when it was recorded
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  now: number,
  hits: GhHit[],
  bpm: number,
  mode: QuantMode,
  gridStart: number | null,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Background
  ctx.fillStyle = "#0f0f14"
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Lane background
  const laneX = CANVAS_W / 2 - LANE_W / 2
  ctx.fillStyle = "#1a1a26"
  ctx.fillRect(laneX, 0, LANE_W, CANVAS_H)

  // Lane borders
  ctx.strokeStyle = "#333355"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(laneX, 0); ctx.lineTo(laneX, CANVAS_H)
  ctx.moveTo(laneX + LANE_W, 0); ctx.lineTo(laneX + LANE_W, CANVAS_H)
  ctx.stroke()

  // Subdivision lines scrolling up
  if (gridStart !== null) {
    const sub = subdivMs(mode, bpm)
    const elapsed = now - gridStart
    const offsetPx = (elapsed % sub) * SCROLL_PX_PER_MS
    let y = HIT_ZONE_Y - offsetPx
    while (y > 0) {
      ctx.strokeStyle = "rgba(100,100,180,0.35)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(laneX, y); ctx.lineTo(laneX + LANE_W, y)
      ctx.stroke()
      ctx.setLineDash([])
      y -= sub * SCROLL_PX_PER_MS
    }
  }

  // Hit zone line
  ctx.strokeStyle = "rgba(255,255,255,0.5)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(laneX - 8, HIT_ZONE_Y); ctx.lineTo(laneX + LANE_W + 8, HIT_ZONE_Y)
  ctx.stroke()

  // Hits (gems + ghost outlines)
  const MAX_DEV_PX = LANE_W / 2 - 4  // max horizontal offset inside lane
  const MAX_DEV_MS = 50               // 50ms = full offset

  for (const hit of hits) {
    const age = now - hit.arrivedAt
    if (age > HIT_FADE_MS) continue
    const alpha = Math.max(0, 1 - age / HIT_FADE_MS)
    const ageScrolled = age * SCROLL_PX_PER_MS
    const y = HIT_ZONE_Y - ageScrolled
    if (y < -10) continue

    const devClamped = Math.max(-MAX_DEV_MS, Math.min(MAX_DEV_MS, hit.deviationMs))
    const offsetX = (devClamped / MAX_DEV_MS) * MAX_DEV_PX
    const cx = CANVAS_W / 2 + offsetX
    const ghostX = CANVAS_W / 2
    const r = 6
    const color = deviationColor(Math.abs(hit.deviationMs))

    // Connecting line from ghost to gem
    if (Math.abs(offsetX) > 2) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ghostX, y); ctx.lineTo(cx, y)
      ctx.stroke()
    }

    // Ghost outline at quantized position
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ghostX, y, r, 0, Math.PI * 2)
    ctx.stroke()

    // Solid gem at actual hit position
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.font = "10px monospace"
  ctx.textAlign = "left"
  ctx.fillText("early ←", laneX - LANE_W - 40, HIT_ZONE_Y + 4)
  ctx.textAlign = "right"
  ctx.fillText("→ late", laneX + LANE_W + LANE_W + 40, HIT_ZONE_Y + 4)
}

// ── Main component ────────────────────────────────────────────────────────────

export function DrumRecorder({ bpm, isMetronomePlaying, gridStartTime, onSessionEnd }: DrumRecorderProps) {
  const [source, setSource] = useState<"audio" | "midi">("audio")
  const [quantMode, setQuantMode] = useState<QuantMode>("1/8")
  const [swingRatio, setSwingRatio] = useState(0.625)  // ~62.5% ≈ light swing
  const [sensitivity, setSensitivity] = useState(1.5)
  const [isRecording, setIsRecording] = useState(false)
  const [hits, setHits] = useState<HitRecord[]>([])

  const ghHitsRef = useRef<GhHit[]>([])
  const animFrameRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Audio detection refs
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const prevMagRef = useRef<Float32Array | null>(null)
  const fluxHistRef = useRef<number[]>([])
  const lastHitRef = useRef<number>(0)
  const audioRafRef = useRef<number>(0)

  // MIDI refs
  const midiAccessRef = useRef<MIDIAccess | null>(null)

  // Keep stable refs for current values used in callbacks
  const gridStartRef = useRef(gridStartTime)
  const quantModeRef = useRef(quantMode)
  const bpmRef = useRef(bpm)
  const swingRef = useRef(swingRatio)
  const sensitivityRef = useRef(sensitivity)
  useEffect(() => { gridStartRef.current = gridStartTime }, [gridStartTime])
  useEffect(() => { quantModeRef.current = quantMode }, [quantMode])
  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { swingRef.current = swingRatio }, [swingRatio])
  useEffect(() => { sensitivityRef.current = sensitivity }, [sensitivity])

  const recordHit = useCallback((hitTime: number) => {
    if (!gridStartRef.current) return
    const dev = calcDeviation(hitTime, gridStartRef.current, quantModeRef.current, bpmRef.current, swingRef.current)
    setHits(prev => [...prev, { deviationMs: dev, timestamp: hitTime }])
    ghHitsRef.current = [...ghHitsRef.current, { deviationMs: dev, arrivedAt: performance.now() }]
  }, [])

  // Canvas animation loop
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!

    let running = true
    function frame() {
      if (!running) return
      const now = performance.now()
      // Prune old hits
      ghHitsRef.current = ghHitsRef.current.filter(h => now - h.arrivedAt < HIT_FADE_MS + 200)
      drawGrid(ctx, now, ghHitsRef.current, bpmRef.current, quantModeRef.current, gridStartRef.current)
      animFrameRef.current = requestAnimationFrame(frame)
    }
    animFrameRef.current = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(audioRafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
  }, [])

  const startAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    streamRef.current = stream
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    analyserRef.current = analyser

    const bufLen = analyser.frequencyBinCount
    const magBuf = new Float32Array(bufLen)
    prevMagRef.current = new Float32Array(bufLen)
    fluxHistRef.current = []

    function detect() {
      const analyserNode = analyserRef.current
      if (!analyserNode) return
      analyserNode.getFloatFrequencyData(magBuf)

      // Convert dB to linear magnitude
      let flux = 0
      const prev = prevMagRef.current!
      for (let k = 0; k < bufLen; k++) {
        const mag = Math.pow(10, magBuf[k] / 20)
        const diff = mag - (Math.pow(10, prev[k] / 20))
        flux += diff > 0 ? diff : 0
        prev[k] = magBuf[k]
      }

      fluxHistRef.current.push(flux)
      if (fluxHistRef.current.length > 43) fluxHistRef.current.shift()
      const mean = fluxHistRef.current.reduce((a, b) => a + b, 0) / fluxHistRef.current.length
      const threshold = mean * sensitivityRef.current

      const now = performance.now()
      if (flux > threshold && now - lastHitRef.current > 80) {
        lastHitRef.current = now
        recordHit(now)
      }

      audioRafRef.current = requestAnimationFrame(detect)
    }
    audioRafRef.current = requestAnimationFrame(detect)
  }, [recordHit])

  const stopMidi = useCallback(() => {
    if (midiAccessRef.current) {
      for (const input of midiAccessRef.current.inputs.values()) {
        input.onmidimessage = null
      }
    }
  }, [])

  const startMidi = useCallback(async () => {
    if (!navigator.requestMIDIAccess) {
      alert("Web MIDI is not supported in this browser. Try Chrome.")
      return
    }
    const access = await navigator.requestMIDIAccess()
    midiAccessRef.current = access
    for (const input of access.inputs.values()) {
      input.onmidimessage = (e: MIDIMessageEvent) => {
        if (!e.data) return
        const [status, , velocity] = Array.from(e.data)
        if ((status & 0xf0) === 0x90 && velocity > 0) {
          recordHit(e.timeStamp)
        }
      }
    }
  }, [recordHit])

  const startRecording = useCallback(async () => {
    setHits([])
    ghHitsRef.current = []
    setIsRecording(true)
    try {
      if (source === "audio") await startAudio()
      else await startMidi()
    } catch {
      setIsRecording(false)
    }
  }, [source, startAudio, startMidi])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    if (source === "audio") stopAudio()
    else stopMidi()

    setHits(prev => {
      if (prev.length === 0) return prev
      const devs = prev.map(h => h.deviationMs)
      const avg = devs.reduce((a, b) => a + b, 0) / devs.length
      const std = Math.sqrt(devs.reduce((a, b) => a + (b - avg) ** 2, 0) / devs.length)
      onSessionEnd({ avgDeviationMs: avg, deviationStdMs: std, hitCount: devs.length })
      return prev
    })
  }, [source, stopAudio, stopMidi, onSessionEnd])

  // Stop recording if metronome stops (deferred to avoid setState in effect body)
  useEffect(() => {
    if (!isMetronomePlaying && isRecording) {
      const id = setTimeout(stopRecording, 0)
      return () => clearTimeout(id)
    }
  }, [isMetronomePlaying, isRecording, stopRecording])

  useEffect(() => () => { stopAudio(); stopMidi() }, [stopAudio, stopMidi])

  const isSwing = quantMode === "1/8S" || quantMode === "1/16S"
  const avgDev = hits.length > 0
    ? hits.reduce((a, h) => a + h.deviationMs, 0) / hits.length
    : null
  const stdDev = hits.length > 1 && avgDev !== null
    ? Math.sqrt(hits.reduce((a, h) => a + (h.deviationMs - avgDev!) ** 2, 0) / hits.length)
    : null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Accuracy Recorder
      </h3>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Source toggle */}
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${source === "audio" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => !isRecording && setSource("audio")}
              disabled={isRecording}
            >
              <Mic className="h-3 w-3" /> Mic
            </button>
            <button
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${source === "midi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => !isRecording && setSource("midi")}
              disabled={isRecording}
            >
              <Piano className="h-3 w-3" /> MIDI
            </button>
          </div>
        </div>

        {/* Quantization */}
        <div className="space-y-1">
          <Label className="text-xs">Quantize</Label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={quantMode}
            onChange={e => !isRecording && setQuantMode(e.target.value as QuantMode)}
            disabled={isRecording}
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
          </select>
        </div>

        {/* Swing slider */}
        {isSwing && (
          <div className="space-y-1">
            <Label className="text-xs">Swing {Math.round(swingRatio * 100)}%</Label>
            <input
              type="range"
              min={50}
              max={75}
              step={1}
              value={Math.round(swingRatio * 100)}
              onChange={e => setSwingRatio(Number(e.target.value) / 100)}
              className="w-24 accent-primary"
              disabled={isRecording}
            />
          </div>
        )}

        {/* Sensitivity (audio mode only) */}
        {source === "audio" && (
          <div className="space-y-1">
            <Label className="text-xs">Sensitivity {sensitivity.toFixed(1)}×</Label>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={Math.round(sensitivity * 10)}
              onChange={e => setSensitivity(Number(e.target.value) / 10)}
              className="w-24 accent-primary"
              disabled={isRecording}
            />
          </div>
        )}

        {/* Record button */}
        <Button
          size="sm"
          variant={isRecording ? "destructive" : "default"}
          disabled={!isMetronomePlaying}
          onClick={isRecording ? stopRecording : startRecording}
          className="ml-auto"
        >
          {isRecording ? (
            <><Square className="mr-1.5 h-3.5 w-3.5" /> Stop</>
          ) : (
            <><Play className="mr-1.5 h-3.5 w-3.5" /> Record</>
          )}
        </Button>
      </div>

      {!isMetronomePlaying && !isRecording && (
        <p className="text-xs text-muted-foreground">Start the metronome to enable recording.</p>
      )}

      {/* Guitar Hero visual grid */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-md"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* Stats */}
      {hits.length > 0 && avgDev !== null && (
        <div className="flex gap-4 text-xs text-muted-foreground font-mono">
          <span>
            Avg:{" "}
            <span style={{ color: deviationColor(Math.abs(avgDev)) }}>
              {avgDev > 0 ? "+" : ""}{avgDev.toFixed(1)} ms
            </span>
          </span>
          {stdDev !== null && (
            <span>Std: ±{stdDev.toFixed(1)} ms</span>
          )}
          <span>Hits: {hits.length}</span>
        </div>
      )}
    </div>
  )
}
