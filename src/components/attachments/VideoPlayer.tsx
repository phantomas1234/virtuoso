"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

const SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
type Speed = (typeof SPEEDS)[number]

export function pitchCorrectionSemitones(speed: number): number {
  return -12 * Math.log2(speed)
}

interface VideoPlayerProps {
  url: string
}

export function VideoPlayer({ url }: VideoPlayerProps) {
  const [speed, setSpeed] = useState<Speed>(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const speedRef = useRef<Speed>(1)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  async function initAudio(semitones: number) {
    if (audioCtxRef.current) return

    const video = videoRef.current!
    video.preservesPitch = false

    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    try {
      await ctx.audioWorklet.addModule("/pitch-processor.worklet.js")
    } catch (err) {
      console.error("AudioWorklet load failed:", err)
      return
    }

    const source = ctx.createMediaElementSource(video)
    sourceNodeRef.current = source

    const worklet = new AudioWorkletNode(ctx, "pitch-processor")
    workletNodeRef.current = worklet

    worklet.port.postMessage({ type: "pitch", semitones })

    source.connect(worklet)
    worklet.connect(ctx.destination)

    await ctx.resume()
  }

  function handleSpeedChange(newSpeed: Speed) {
    speedRef.current = newSpeed
    setSpeed(newSpeed)
    videoRef.current!.playbackRate = newSpeed

    const semitones = pitchCorrectionSemitones(newSpeed)

    if (audioCtxRef.current) {
      workletNodeRef.current?.port.postMessage({ type: "pitch", semitones })
      audioCtxRef.current.resume()
    } else if (newSpeed !== 1) {
      initAudio(semitones)
    }
  }

  // Resume AudioContext on play (browser autoplay policy requires user gesture)
  useEffect(() => {
    const video = videoRef.current!
    const onPlay = () => audioCtxRef.current?.resume()
    video.addEventListener("play", onPlay)
    return () => video.removeEventListener("play", onPlay)
  }, [])

  // Flush SoundTouch buffer on seek to avoid stale samples
  useEffect(() => {
    const video = videoRef.current!
    const onSeeking = () => workletNodeRef.current?.port.postMessage({ type: "flush" })
    video.addEventListener("seeking", onSeeking)
    return () => video.removeEventListener("seeking", onSeeking)
  }, [])

  // Tear down Web Audio graph on unmount
  useEffect(() => {
    return () => {
      workletNodeRef.current?.disconnect()
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
