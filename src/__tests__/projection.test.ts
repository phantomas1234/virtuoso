import { describe, it, expect } from "vitest"
import { computeProjections } from "@/lib/projection"

function makeEntries(points: [string, number][]) {
  return points.map(([date, bpm]) => ({ date: new Date(date), bpm }))
}

describe("computeProjections", () => {
  it("returns null with fewer than 3 entries", () => {
    const entries = makeEntries([["2024-01-01", 100], ["2024-02-01", 110]])
    expect(computeProjections(entries, 180)).toBeNull()
  })

  it("returns null when all entries already meet or exceed target", () => {
    const entries = makeEntries([
      ["2024-01-01", 180],
      ["2024-02-01", 190],
      ["2024-03-01", 200],
    ])
    expect(computeProjections(entries, 180)).toBeNull()
  })

  it("picks the model with lowest RSS as best", () => {
    // Perfectly linear data — linear model should win
    const entries = makeEntries([
      ["2024-01-01", 100],
      ["2024-02-01", 110],
      ["2024-03-01", 120],
      ["2024-04-01", 130],
      ["2024-05-01", 140],
    ])
    const result = computeProjections(entries, 200)
    expect(result).not.toBeNull()
    expect(result!.best).toBe("linear")
  })

  it("linear fit projects a sensible date for perfectly linear data", () => {
    const entries = makeEntries([
      ["2024-01-01", 100],
      ["2024-02-01", 110],
      ["2024-03-01", 120],
      ["2024-04-01", 130],
    ])
    const result = computeProjections(entries, 200)
    expect(result).not.toBeNull()
    const fit = result!.fits.linear!
    expect(fit).not.toBeNull()
    // 70 BPM gap from last entry at 130, ~10 BPM/month → ~7 months ≈ 210 days ahead, ~300 days from origin
    expect(fit.projectedDays).toBeGreaterThan(200)
    expect(fit.projectedDays).toBeLessThan(400)
  })

  it("returns null if trend is flat or decreasing", () => {
    const entries = makeEntries([
      ["2024-01-01", 150],
      ["2024-02-01", 140],
      ["2024-03-01", 130],
    ])
    expect(computeProjections(entries, 200)).toBeNull()
  })

  it("poly3 requires at least 4 entries", () => {
    const entries = makeEntries([
      ["2024-01-01", 100],
      ["2024-02-01", 115],
      ["2024-03-01", 125],
    ])
    const result = computeProjections(entries, 200)
    expect(result?.fits.poly3).toBeNull()
  })

  it("predict function is consistent with projectedDays", () => {
    const entries = makeEntries([
      ["2024-01-01", 100],
      ["2024-02-01", 115],
      ["2024-03-01", 127],
      ["2024-04-01", 138],
      ["2024-05-01", 147],
    ])
    const result = computeProjections(entries, 200)
    expect(result).not.toBeNull()
    const fit = result!.fits[result!.best]!
    expect(fit.projectedDays).not.toBeNull()
    // predict at projectedDays should equal targetBpm within tolerance
    const predicted = fit.predict(fit.projectedDays!)
    expect(predicted).toBeCloseTo(200, 0)
  })
})
