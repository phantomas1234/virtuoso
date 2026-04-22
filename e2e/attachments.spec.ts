import { test, expect } from "@playwright/test"

test.describe("Attachments (unauthenticated redirect)", () => {
  test("redirects goal detail to login when not authenticated", async ({ page }) => {
    await page.goto("/goals/test-id")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("YouTube embed", () => {
  test.skip("YouTube URL is embedded on goal detail page", async ({ page }) => {
    // Requires authenticated session + seeded goal with youtubeUrl
    await page.goto("/goals/seeded-goal-with-youtube")

    const iframe = page.frameLocator('iframe[src*="youtube.com/embed"]')
    await expect(iframe.locator("body")).toBeTruthy()
  })
})
