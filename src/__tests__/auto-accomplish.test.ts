import { describe, it, expect } from "vitest"

function checkAutoAccomplish(params: {
  goalType: "BPM" | "OPEN"
  status: "ACTIVE" | "ACCOMPLISHED" | "ARCHIVED"
  targetBpm: number | null
  achievedBpm: number | undefined
}): boolean {
  const { goalType, status, targetBpm, achievedBpm } = params
  return (
    goalType === "BPM" &&
    status === "ACTIVE" &&
    targetBpm !== null &&
    achievedBpm !== undefined &&
    achievedBpm >= targetBpm
  )
}

describe("auto-accomplish logic", () => {
  it("accomplishes when BPM exactly meets target", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACTIVE", targetBpm: 120, achievedBpm: 120 })
    ).toBe(true)
  })

  it("accomplishes when BPM exceeds target", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACTIVE", targetBpm: 120, achievedBpm: 135 })
    ).toBe(true)
  })

  it("does not accomplish when BPM is below target", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACTIVE", targetBpm: 120, achievedBpm: 100 })
    ).toBe(false)
  })

  it("does not accomplish OPEN goals", () => {
    expect(
      checkAutoAccomplish({ goalType: "OPEN", status: "ACTIVE", targetBpm: null, achievedBpm: undefined })
    ).toBe(false)
  })

  it("does not accomplish already-accomplished goals", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACCOMPLISHED", targetBpm: 120, achievedBpm: 125 })
    ).toBe(false)
  })

  it("does not accomplish archived goals", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ARCHIVED", targetBpm: 120, achievedBpm: 125 })
    ).toBe(false)
  })

  it("does not accomplish when targetBpm is null", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACTIVE", targetBpm: null, achievedBpm: 125 })
    ).toBe(false)
  })

  it("does not accomplish when achievedBpm is undefined", () => {
    expect(
      checkAutoAccomplish({ goalType: "BPM", status: "ACTIVE", targetBpm: 120, achievedBpm: undefined })
    ).toBe(false)
  })
})
