import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to /login from /dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("unauthenticated user is redirected to /login from /goals", async ({ page }) => {
    await page.goto("/goals/some-id")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page shows OAuth buttons", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("Continue with Google")).toBeVisible()
    await expect(page.getByText("Continue with GitHub")).toBeVisible()
    await expect(page.getByText("Continue with Apple")).toBeVisible()
  })

  test("login page shows Virtuoso branding", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("Virtuoso")).toBeVisible()
    await expect(page.getByText("Track your musical journey")).toBeVisible()
  })
})
