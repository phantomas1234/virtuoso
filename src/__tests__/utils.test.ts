import { describe, it, expect } from "vitest"
import { cn, bpmProgressColor } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz")
  })

  it("deduplicates tailwind conflicts", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("handles undefined values", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar")
  })

  it("returns empty string for no args", () => {
    expect(cn()).toBe("")
  })
})

describe("bpmProgressColor", () => {
  it("returns muted for null", () => {
    expect(bpmProgressColor(null)).toEqual({ bar: "bg-muted", text: "text-muted-foreground" })
  })

  it("returns emerald at 100%", () => {
    expect(bpmProgressColor(100).bar).toBe("bg-emerald-500")
  })

  it("returns emerald above 100%", () => {
    expect(bpmProgressColor(110).bar).toBe("bg-emerald-500")
  })

  it("returns green at 90%", () => {
    expect(bpmProgressColor(90).bar).toBe("bg-green-500")
  })

  it("returns blue at 75%", () => {
    expect(bpmProgressColor(75).bar).toBe("bg-blue-500")
  })

  it("returns amber at 50%", () => {
    expect(bpmProgressColor(50).bar).toBe("bg-amber-500")
  })

  it("returns red below 50%", () => {
    expect(bpmProgressColor(49).bar).toBe("bg-red-500")
  })
})
