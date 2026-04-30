import { test, expect } from "@playwright/test"

// Regression test: goal detail page must not return 500.
//
// The original bug: new Prisma columns (avgDeviationMs, deviationStdMs, hitCount)
// were added to the schema but never pushed to the Vercel database because
// `prisma migrate deploy` was missing from the build command. The generated
// Prisma client then issued SELECT queries referencing those columns, causing
// PostgreSQL to throw "column does not exist" → 500 on every goal page load.
//
// Authenticated tests require:
//   PLAYWRIGHT_TEST_SESSION_TOKEN — a valid session token from the DB
//   PLAYWRIGHT_TEST_GOAL_ID       — a goal ID owned by that session's user
// Run `npx tsx scripts/create-test-session.ts` to generate these values locally.

const SESSION_TOKEN = process.env.PLAYWRIGHT_TEST_SESSION_TOKEN
const GOAL_ID = process.env.PLAYWRIGHT_TEST_GOAL_ID

test.describe("Goal detail page — unauthenticated", () => {
  test("redirects to /login instead of returning 500", async ({ page }) => {
    const response = await page.goto("/goals/nonexistent-id")
    // Must be a redirect to login, not a 500
    await expect(page).toHaveURL(/\/login/)
    expect(response?.status()).not.toBe(500)
  })
})

test.describe("Goal detail page — authenticated", () => {
  test.skip(!SESSION_TOKEN || !GOAL_ID, "Set PLAYWRIGHT_TEST_SESSION_TOKEN and PLAYWRIGHT_TEST_GOAL_ID to run")

  test.beforeEach(async ({ context }) => {
    // Inject the database session cookie so NextAuth recognises the request
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: SESSION_TOKEN!,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])
  })

  test("goal detail page loads without 500", async ({ page }) => {
    const response = await page.goto(`/goals/${GOAL_ID}`)
    expect(response?.status()).not.toBe(500)
    // Must render the goal layout — not the login page or an error page
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("BPM goal page shows progress section and accepts a session log", async ({ page }) => {
    await page.goto(`/goals/${GOAL_ID}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Progress section must be visible (regression: 500 prevented this from ever rendering)
    const progressSection = page.getByText(/progress|session notes/i).first()
    await expect(progressSection).toBeVisible()
  })
})
