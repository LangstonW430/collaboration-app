import { test, expect, chromium } from '@playwright/test'
import { signIn, signOut, TEST_USERS } from './helpers/auth'

/**
 * Real-time update tests.
 * These verify that Convex's live query subscriptions push content to connected
 * clients without requiring a manual page refresh.
 *
 * Most tests need two browser contexts.  Single-context tests cover the
 * simpler case of the same user in the same tab.
 */

test.describe('Real-time updates', () => {
  // ── same-tab autosave indicator ────────────────────────────────────────────

  test('save status cycles through saving → saved without reload', async ({ page }) => {
    await signIn(page, TEST_USERS.alice)
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    const editor = page.locator('.tiptap-editor [contenteditable="true"]').first()
    await editor.click()
    await page.keyboard.type('Realtime test content')

    // "Saving…" should appear during the debounce period
    await expect(page.getByText(/saving/i)).toBeVisible({ timeout: 5_000 })

    // Then transition to "Saved" once the mutation completes
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 })

    await signOut(page)
  })

  // ── dashboard updates without reload ──────────────────────────────────────

  test('new document appears on dashboard without page refresh', async ({ page }) => {
    await signIn(page, TEST_USERS.alice)

    // Open dashboard in a visible state
    await expect(page.getByRole('heading', { name: 'My Documents' })).toBeVisible()

    const title = `Live Doc ${Date.now()}`

    // Open editor in same tab, create doc, title it
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })
    await page.getByPlaceholder('Untitled Document').fill(title)
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })

    // Navigate back without hard-refresh
    await page.getByTitle('Back to dashboard').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })

    // The document should appear via Convex live query (no F5 needed)
    await expect(page.getByText(title)).toBeVisible({ timeout: 12_000 })

    await signOut(page)
  })

  // ── two-context realtime sync ──────────────────────────────────────────────

  test('title change by owner is reflected in another open session', async () => {
    test.skip(
      !process.env.E2E_USER2_EMAIL,
      'Skipped: requires two test accounts (E2E_USER2_EMAIL)'
    )

    const browser = await chromium.launch()
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      // Alice creates a document
      await signIn(page1, TEST_USERS.alice)
      await page1.getByRole('button', { name: /new|create/i }).first().click()
      await page1.waitForURL(/\/doc\//, { timeout: 15_000 })
      const docUrl = page1.url()

      // Bob opens the same document (assumes Bob has been invited)
      await signIn(page2, TEST_USERS.bob)
      await page2.goto(docUrl)
      await page2.waitForURL(docUrl, { timeout: 10_000 })

      const newTitle = `Shared Title ${Date.now()}`

      // Alice changes the title
      await page1.getByPlaceholder('Untitled Document').fill(newTitle)
      await expect(page1.getByText('Saved')).toBeVisible({ timeout: 10_000 })

      // Bob's page should reflect the new title without refreshing
      await expect(page2.getByDisplayValue(newTitle)).toBeVisible({ timeout: 12_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
      await browser.close()
    }
  })

  // ── connection status indicator ────────────────────────────────────────────

  test('connection status shows "Connected" in the status bar', async ({ page }) => {
    await signIn(page, TEST_USERS.alice)
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    // The status bar at the bottom of the editor shows the connection dot
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 8_000 })

    await signOut(page)
  })

  // ── offline banner ─────────────────────────────────────────────────────────

  test('going offline shows the "Offline" banner and disables editing', async ({
    page,
    context,
  }) => {
    await signIn(page, TEST_USERS.alice)
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    // Simulate going offline
    await context.setOffline(true)

    // The toolbar should show the offline indicator
    await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 8_000 })

    // Restore connection
    await context.setOffline(false)

    // Banner should disappear
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 })

    await signOut(page)
  })
})
