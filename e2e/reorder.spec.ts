import { test, expect } from "@playwright/test"

test.describe("Goal reordering (unauthenticated redirect)", () => {
  test("redirects /dashboard to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })
})

// Authenticated drag-and-drop tests run against a seeded database.
// Skip in CI until a test auth setup is configured.
test.describe("Goal reordering (authenticated)", () => {
  test.skip("drag-and-drop reorders goals and persists after refresh", async ({ page }) => {
    await page.goto("/dashboard")

    const cards = page.locator("[data-testid='goal-card']")
    const firstCard = cards.first()
    const secondCard = cards.nth(1)

    const firstTitle = await firstCard.innerText()

    // Drag first card below second
    await firstCard.dragTo(secondCard)

    // After drag, second card should now be first
    const newFirstTitle = await cards.first().innerText()
    expect(newFirstTitle).not.toBe(firstTitle)

    // Refresh and verify persistence
    await page.reload()
    const reloadedFirstTitle = await cards.first().innerText()
    expect(reloadedFirstTitle).toBe(newFirstTitle)
  })
})
