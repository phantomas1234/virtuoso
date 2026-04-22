"use client"

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"

export function useConfetti() {
  const fired = useRef(false)

  const fire = () => {
    if (fired.current) return
    fired.current = true

    const count = 200
    const defaults = { origin: { y: 0.7 } }

    function shoot(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      })
    }

    shoot(0.25, { spread: 26, startVelocity: 55 })
    shoot(0.2, { spread: 60 })
    shoot(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
    shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    shoot(0.1, { spread: 120, startVelocity: 45 })

    setTimeout(() => {
      fired.current = false
    }, 3000)
  }

  return { fire }
}

interface ConfettiTriggerProps {
  trigger: boolean
}

export function ConfettiTrigger({ trigger }: ConfettiTriggerProps) {
  const { fire } = useConfetti()

  useEffect(() => {
    if (trigger) fire()
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
