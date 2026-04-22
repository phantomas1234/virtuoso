import { test, expect } from "@playwright/test"

// These tests require an authenticated session.
// Set up auth state by adding a globalSetup that creates a test user and session cookie.
// For now, tests use the mock session fixture pattern.

test.describe("Goals (unauthenticated redirect)", () => {
  test("redirects /goals/new to login when not authenticated", async ({ page }) => {
    await page.goto("/goals/new")
    await expect(page).toHaveURL(/\/login/)
  })
})

// Authenticated tests require a test account setup.
// These run against a real DB with PLAYWRIGHT_TEST_USER_EMAIL + PLAYWRIGHT_TEST_USER_PASSWORD env vars.
// See e2e/setup/global-setup.ts for session creation.
test.describe("Goals (authenticated)", () => {
  test.skip("create a BPM goal and log progress below target", async ({ page }) => {
    await page.goto("/goals/new")
    await page.getByLabel("Title").fill("Test BPM Goal")
    await page.getByRole("combobox").selectOption("BPM")
    await page.getByLabel("Target BPM").fill("120")
    await page.getByRole("button", { name: "Create goal" }).click()
    await expect(page).toHaveURL(/\/goals\//)

    // Log a session below target
    await page.getByRole("button", { name: "+ Log session" }).click()
    await page.getByLabel("BPM achieved").fill("100")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Progress logged!")).toBeVisible()
    // Status should still be Active
    await expect(page.getByText("Active")).toBeVisible()
  })

  test.skip("auto-accomplishes when BPM meets target", async ({ page }) => {
    // Navigate to the test goal created above (would need a fixture)
    // Log BPM at or above target
    await page.getByRole("button", { name: "+ Log session" }).click()
    await page.getByLabel("BPM achieved").fill("120")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Goal accomplished!")).toBeVisible()
    await expect(page.getByText("Accomplished")).toBeVisible()
  })
})
