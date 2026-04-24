import { describe, it, expect } from "vitest"

type HandEntry = { hand: "LEFT" | "RIGHT" | null; bpm: number | null }

function checkSplitHandsAccomplish(params: {
  targetBpm: number
  entries: HandEntry[]
}): boolean {
  const { targetBpm, entries } = params
  const leftMax = Math.max(0, ...entries.filter(e => e.hand === "LEFT").map(e => e.bpm ?? 0))
  const rightMax = Math.max(0, ...entries.filter(e => e.hand === "RIGHT").map(e => e.bpm ?? 0))
  return leftMax >= targetBpm && rightMax >= targetBpm
}

describe("split-hands accomplishment logic", () => {
  it("accomplishes when both hands meet target", () => {
    expect(checkSplitHandsAccomplish({
      targetBpm: 180,
      entries: [
        { hand: "LEFT", bpm: 180 },
        { hand: "RIGHT", bpm: 185 },
      ],
    })).toBe(true)
  })

  it("does not accomplish when only left hand meets target", () => {
    expect(checkSplitHandsAccomplish({
      targetBpm: 180,
      entries: [
        { hand: "LEFT", bpm: 180 },
        { hand: "RIGHT", bpm: 150 },
      ],
    })).toBe(false)
  })

  it("does not accomplish when only right hand meets target", () => {
    expect(checkSplitHandsAccomplish({
      targetBpm: 180,
      entries: [
        { hand: "LEFT", bpm: 160 },
        { hand: "RIGHT", bpm: 180 },
      ],
    })).toBe(false)
  })

  it("does not accomplish when no entries exist", () => {
    expect(checkSplitHandsAccomplish({ targetBpm: 180, entries: [] })).toBe(false)
  })

  it("uses the max BPM across multiple sessions per hand", () => {
    expect(checkSplitHandsAccomplish({
      targetBpm: 180,
      entries: [
        { hand: "LEFT", bpm: 160 },
        { hand: "LEFT", bpm: 185 },
        { hand: "RIGHT", bpm: 175 },
        { hand: "RIGHT", bpm: 180 },
      ],
    })).toBe(true)
  })

  it("does not accomplish when one hand has no entries", () => {
    expect(checkSplitHandsAccomplish({
      targetBpm: 180,
      entries: [{ hand: "LEFT", bpm: 190 }],
    })).toBe(false)
  })
})
