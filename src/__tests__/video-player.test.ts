import { describe, it, expect } from "vitest"
import { pitchCorrectionSemitones } from "@/components/attachments/VideoPlayer"

describe("pitchCorrectionSemitones", () => {
  it("returns 0 at normal speed (no correction needed)", () => {
    expect(pitchCorrectionSemitones(1)).toBeCloseTo(0)
  })

  it("returns +12 at 0.5× (browser drops one octave, we raise it back)", () => {
    expect(pitchCorrectionSemitones(0.5)).toBeCloseTo(12, 5)
  })

  it("returns correct value at 0.75×", () => {
    expect(pitchCorrectionSemitones(0.75)).toBeCloseTo(4.981, 2)
  })

  it("returns correct value at 0.6×", () => {
    expect(pitchCorrectionSemitones(0.6)).toBeCloseTo(8.844, 2)
  })

  it("returns correct value at 0.8×", () => {
    expect(pitchCorrectionSemitones(0.8)).toBeCloseTo(3.863, 2)
  })

  it("returns correct value at 0.9×", () => {
    expect(pitchCorrectionSemitones(0.9)).toBeCloseTo(1.824, 2)
  })

  it("correction is always non-negative (we always raise pitch)", () => {
    for (const speed of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      expect(pitchCorrectionSemitones(speed)).toBeGreaterThanOrEqual(0)
    }
  })
})
