import { describe, it, expect } from "vitest"
import { extractYouTubeId } from "@/components/attachments/YouTubeEmbed"

describe("extractYouTubeId", () => {
  it("extracts ID from standard watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from short youtu.be URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from embed URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from v/ URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from shorts URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("handles URL with extra query params", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ")
  })

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeId("https://vimeo.com/12345678")).toBeNull()
  })

  it("returns null for invalid URLs", () => {
    expect(extractYouTubeId("not-a-url")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(extractYouTubeId("")).toBeNull()
  })
})
