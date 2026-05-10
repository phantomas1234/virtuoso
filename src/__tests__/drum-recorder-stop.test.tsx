import { render, screen, fireEvent, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { useState } from "react"
import { DrumRecorder, type SessionStats } from "@/components/goals/DrumRecorder"

// Regression: stopRecording was calling onSessionEnd inside a setHits state updater,
// which triggered "Cannot update a component while rendering a different component".
// The fix reads from allHitsRef synchronously instead of inside the updater.

describe("DrumRecorder — stopRecording", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {
        clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
        arc: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1,
        font: "", textAlign: "", textBaseline: "",
      } as unknown as CanvasRenderingContext2D
    )

    vi.stubGlobal("AudioContext", vi.fn(() => ({
      outputLatency: 0, baseLatency: 0, close: vi.fn(),
    })))

    Object.defineProperty(navigator, "requestMIDIAccess", {
      value: vi.fn().mockRejectedValue(new Error("no midi")),
      configurable: true,
    })

    vi.spyOn(global, "requestAnimationFrame").mockImplementation(() => 1)
    vi.spyOn(global, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("calls onSessionEnd outside a state updater (no setState-during-render)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    // Wrapper mimics PracticeSection: onSessionEnd calls setState on the parent.
    // If onSessionEnd fires inside a React state updater this triggers the warning.
    function Wrapper() {
      const [, setStats] = useState<SessionStats | null>(null)
      return (
        <DrumRecorder
          bpm={120}
          isMetronomePlaying={true}
          gridStartTime={performance.now() - 2000}
          onSessionEnd={setStats}
        />
      )
    }

    render(<Wrapper />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /record/i }))
    })

    // Hit a test pad so onSessionEnd receives real data
    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: /^kick$/i }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop/i }))
    })

    const badSetState = errorSpy.mock.calls.find(
      ([msg]) => typeof msg === "string" && msg.includes("Cannot update a component")
    )
    expect(badSetState, "setState-during-render detected — onSessionEnd must not be called inside a state updater").toBeUndefined()

    errorSpy.mockRestore()
  })
})
