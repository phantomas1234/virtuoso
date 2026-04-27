"use client"

import { useState, useEffect, useRef } from "react"
import { SoundTouch, SimpleFilter } from "soundtouchjs"
import { Button } from "@/components/ui/button"

const SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
type Speed = (typeof SPEEDS)[number]

const BUFFER_SIZE = 4096

// Pitch correction in semitones needed to undo the pitch change caused by
// video.playbackRate. At 0.5× the browser drops pitch by 12 semitones, so we
// raise it by 12; at 0.75× we raise by ~4.98; at 1× no correction needed.
export function pitchCorrectionSemitones(speed: number): number {
  return -12 * Math.log2(speed)
}

// Ring-buffer source that bridges MediaElementAudioSourceNode (push) with
// soundtouchjs SimpleFilter (pull). ScriptProcessorNode pushes interleaved
// PCM in; SimpleFilter.extract() pulls it out.
class StreamingSource {
  private queue: Float32Array[] = []
  position = 0

  extract(target: Float32Array, numFrames: number): number {
    let written = 0
    while (written < numFrames && this.queue.length > 0) {
      const chunk = this.queue[0]
      const chunkFrames = chunk.length / 2
      const take = Math.min(numFrames - written, chunkFrames)
      for (let i = 0; i < take; i++) {
        target[(written + i) * 2] = chunk[i * 2]
        target[(written + i) * 2 + 1] = chunk[i * 2 + 1]
      }
      if (take === chunkFrames) {
        this.queue.shift()
      } else {
        this.queue[0] = chunk.slice(take * 2)
      }
      written += take
    }
    this.position += written
    return written
  }

  push(inL: Float32Array, inR: Float32Array) {
    const n = inL.length
    const interleaved = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      interleaved[i * 2] = inL[i]
      interleaved[i * 2 + 1] = inR[i]
    }
    this.queue.push(interleaved)
  }

  flush() {
    this.queue = []
    this.position = 0
  }
}

interface VideoPlayerProps {
  url: string
  name?: string
}

export function VideoPlayer({ url }: VideoPlayerProps) {
  const [speed, setSpeed] = useState<Speed>(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const speedRef = useRef<Speed>(1) // readable inside audio callbacks without stale closure

  // Web Audio API — all lazily created on first non-1× activation
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamingSourceRef = useRef<StreamingSource | null>(null)
  const filterRef = useRef<SimpleFilter | null>(null)
  const soundTouchRef = useRef<SoundTouch | null>(null)
  const outputSamplesRef = useRef<Float32Array>(new Float32Array(BUFFER_SIZE * 2))

  // Replace the SoundTouch + SimpleFilter pair (called on speed change and on
  // seek) while reusing the same streaming source and processor node.
  function rebuildFilter(semitones: number) {
    const src = streamingSourceRef.current!
    src.flush()
    const st = new SoundTouch()
    st.pitchSemitones = semitones
    st.tempo = 1
    soundTouchRef.current = st
    filterRef.current = new SimpleFilter(src, st)
  }

  function initAudio() {
    if (audioCtxRef.current) return

    const video = videoRef.current!
    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    const source = ctx.createMediaElementSource(video)
    sourceNodeRef.current = source

    const streamingSrc = new StreamingSource()
    streamingSourceRef.current = streamingSrc

    const st = new SoundTouch()
    st.pitchSemitones = pitchCorrectionSemitones(speedRef.current)
    st.tempo = 1
    soundTouchRef.current = st
    filterRef.current = new SimpleFilter(streamingSrc, st)

    const processor = ctx.createScriptProcessor(BUFFER_SIZE, 2, 2)
    processorRef.current = processor

    processor.onaudioprocess = (e) => {
      streamingSrc.push(
        e.inputBuffer.getChannelData(0),
        e.inputBuffer.getChannelData(1),
      )
      const filter = filterRef.current
      if (!filter) return
      const extracted = filter.extract(outputSamplesRef.current, BUFFER_SIZE)
      const outL = e.outputBuffer.getChannelData(0)
      const outR = e.outputBuffer.getChannelData(1)
      for (let i = 0; i < extracted; i++) {
        outL[i] = outputSamplesRef.current[i * 2]
        outR[i] = outputSamplesRef.current[i * 2 + 1]
      }
      for (let i = extracted; i < BUFFER_SIZE; i++) {
        outL[i] = 0
        outR[i] = 0
      }
    }

    source.connect(processor)
    processor.connect(ctx.destination)
  }

  function handleSpeedChange(newSpeed: Speed) {
    speedRef.current = newSpeed
    setSpeed(newSpeed)
    videoRef.current!.playbackRate = newSpeed

    if (audioCtxRef.current) {
      // Audio already initialised — just update the pitch correction
      rebuildFilter(pitchCorrectionSemitones(newSpeed))
      if (newSpeed !== 1) audioCtxRef.current.resume()
    } else if (newSpeed !== 1) {
      // Lazy init on first non-1× selection
      initAudio()
      // Cast breaks TypeScript's narrowing: inside this else-branch TS narrows
      // audioCtxRef.current to null, but initAudio() just set it to AudioContext.
      const ctx = audioCtxRef.current as AudioContext | null
      ctx?.resume()
    }
  }

  // Resume AudioContext on play (browser autoplay policy requires user gesture)
  useEffect(() => {
    const video = videoRef.current!
    const onPlay = () => audioCtxRef.current?.resume()
    video.addEventListener("play", onPlay)
    return () => video.removeEventListener("play", onPlay)
  }, [])

  // Flush SoundTouch on seek to clear stale samples and avoid a glitch
  useEffect(() => {
    const video = videoRef.current!
    const onSeeking = () => {
      if (audioCtxRef.current) {
        rebuildFilter(pitchCorrectionSemitones(speedRef.current))
      }
    }
    video.addEventListener("seeking", onSeeking)
    return () => video.removeEventListener("seeking", onSeeking)
  }, [])

  // Tear down Web Audio graph on unmount
  useEffect(() => {
    return () => {
      processorRef.current?.disconnect()
      sourceNodeRef.current?.disconnect()
      audioCtxRef.current?.close()
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border">
      <video
        ref={videoRef}
        src={url}
        controls
        crossOrigin="anonymous"
        className="w-full"
        style={{ maxHeight: "480px" }}
        playsInline
      >
        <track kind="captions" />
      </video>
      <div className="flex items-center gap-1.5 border-t bg-muted/30 px-3 py-2">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Speed</span>
        {SPEEDS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={speed === s ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => handleSpeedChange(s)}
          >
            {s === 1 ? "1×" : `${s}×`}
          </Button>
        ))}
        {speed !== 1 && (
          <span className="ml-auto text-xs text-muted-foreground">Pitch-corrected</span>
        )}
      </div>
    </div>
  )
}
