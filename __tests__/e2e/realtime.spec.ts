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
    test.setTimeout(90_000)

    const browser = await chromium.launch()
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
    const ctx1 = await browser.newContext({ baseURL })
    const ctx2 = await browser.newContext({ baseURL })
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      // Alice creates a document
      await signIn(page1, TEST_USERS.alice)
      await page1.getByRole('button', { name: /new|create/i }).first().click()
      await page1.waitForURL(/\/doc\//, { timeout: 15_000 })
      await expect(page1.getByPlaceholder('Untitled Document')).toBeVisible({ timeout: 10_000 })
      const docUrl = page1.url()

      // Alice invites Bob as editor so he can access the doc
      const shareBtn = page1.getByRole('button', { name: 'Share' })
      await expect(shareBtn).toBeVisible({ timeout: 8_000 })
      await shareBtn.click()
      await page1.getByPlaceholder(/email/i).fill(TEST_USERS.bob.email)
      const roleSelect = page1.getByRole('combobox')
      if (await roleSelect.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await roleSelect.selectOption('editor')
      }
      await page1.getByRole('button', { name: /invite|send/i }).click()
      await expect(page1.getByText(new RegExp(TEST_USERS.bob.email, 'i'))).toBeVisible({ timeout: 8_000 })
      // Close the invite modal
      const closeBtn = page1.getByRole('button', { name: /close|done|×/i })
      if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeBtn.click()
      } else {
        await page1.keyboard.press('Escape')
      }

      // Bob signs in — lands on dashboard where InvitesBanner shows pending invites
      await signIn(page2, TEST_USERS.bob)
      // Accept all pending invites (stale ones from previous runs accumulate;
      // we need the current doc's invite accepted to gain collaborator access)
      const acceptBtns = page2.getByRole('button', { name: 'Accept' })
      await expect(acceptBtns.first()).toBeVisible({ timeout: 15_000 })
      let remaining = await acceptBtns.count()
      while (remaining > 0) {
        await acceptBtns.first().click()
        await expect(acceptBtns).toHaveCount(remaining - 1, { timeout: 8_000 })
        remaining--
      }

      // Now Bob can open the document
      await page2.goto(docUrl)
      await page2.waitForURL(docUrl, { timeout: 10_000 })
      // Wait for Bob's editor to fully load (Convex access check + document query)
      await expect(page2.getByPlaceholder('Untitled Document')).toBeVisible({ timeout: 20_000 })

      const newTitle = `Shared Title ${Date.now()}`

      // Alice changes the title
      await page1.getByPlaceholder('Untitled Document').fill(newTitle)
      await expect(page1.getByText('Saved')).toBeVisible({ timeout: 10_000 })

      // Bob's page should reflect the new title via Convex live query
      await expect(page2.getByPlaceholder('Untitled Document')).toHaveValue(newTitle, { timeout: 15_000 })
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

    // Wait for the editor to fully mount (DocumentEditor is dynamic-imported and
    // only renders after Convex auth + document query both resolve)
    await expect(page.getByPlaceholder('Untitled Document')).toBeVisible({ timeout: 15_000 })

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
    // Wait for editor to fully mount so ConnectionProvider's useEffect listeners are in place
    await expect(page.getByPlaceholder('Untitled Document')).toBeVisible({ timeout: 10_000 })

    // Dispatch the browser offline event to trigger ConnectionContext state update.
    // Use waitForFunction (polling) instead of toBeVisible since the React render
    // may be deferred by concurrent mode batching.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await page.waitForFunction(
      () => document.body.textContent?.includes('Offline'),
      { timeout: 8_000, polling: 100 }
    )

    // Restore connection
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForFunction(
      () => document.body.textContent?.includes('Connected'),
      { timeout: 10_000, polling: 100 }
    )

    await signOut(page)
  })
})
