import { test, expect } from '@playwright/test'
import { signIn, signOut, TEST_USERS } from './helpers/auth'

const alice = TEST_USERS.alice

// Each test signs in fresh; use beforeEach for speed.
test.describe('Document management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, alice)
  })

  test.afterEach(async ({ page }) => {
    await signOut(page)
  })

  // ── dashboard ──────────────────────────────────────────────────────────────

  test('dashboard loads and shows "My Documents" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'My Documents' })).toBeVisible()
    await expect(page.getByRole('button', { name: /new|create/i }).first()).toBeVisible()
  })

  // ── create document ────────────────────────────────────────────────────────

  test('clicking New Document creates a document and opens the editor', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    // Should navigate to /doc/[id]
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/doc\//)
  })

  test('new document starts with default title', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })
    // The title input should contain "Untitled Document"
    const titleInput = page.getByPlaceholder('Untitled Document')
    await expect(titleInput).toBeVisible()
  })

  // ── edit document ──────────────────────────────────────────────────────────

  test('user can type a title and see it saved', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    const title = `Test Doc ${Date.now()}`
    const titleInput = page.getByPlaceholder('Untitled Document')
    await titleInput.fill(title)

    // Wait for autosave indicator to show "Saved"
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  test('user can type content in the editor', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    const editor = page.locator('.tiptap-editor [contenteditable="true"]').first()
    await editor.click()
    await editor.type('Hello from the test suite!')

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  test('save status shows "Saving…" while writing', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    const editor = page.locator('.tiptap-editor [contenteditable="true"]').first()
    await editor.click()
    // Type and immediately check for saving indicator
    await page.keyboard.type('Typing fast…')
    // At some point it should say "Saving…"
    await expect(page.getByText(/saving/i)).toBeVisible({ timeout: 5_000 })
    // Then settle on "Saved"
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  // ── back navigation ────────────────────────────────────────────────────────

  test('back button returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    // The toolbar has a back arrow link
    await page.getByTitle('Back to dashboard').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  // ── document appears in dashboard ─────────────────────────────────────────

  test('newly created document appears on the dashboard', async ({ page }) => {
    const title = `E2E Doc ${Date.now()}`

    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })

    const titleInput = page.getByPlaceholder('Untitled Document')
    await titleInput.fill(title)
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })

    // Go back to dashboard
    await page.getByTitle('Back to dashboard').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })

    // Wait for docs to load (Convex subscription)
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })
  })

  // ── delete document ────────────────────────────────────────────────────────

  test('user can delete a document from the dashboard', async ({ page }) => {
    const title = `Delete Me ${Date.now()}`

    // Create a document to delete
    await page.getByRole('button', { name: /new|create/i }).first().click()
    await page.waitForURL(/\/doc\//, { timeout: 15_000 })
    await page.getByPlaceholder('Untitled Document').fill(title)
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })
    await page.getByTitle('Back to dashboard').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })

    // Find the document card and open its context menu / delete button
    const card = page.locator('[data-testid="document-card"]').filter({ hasText: title }).first()
    await card.hover()
    const deleteButton = card.getByRole('button', { name: /delete/i })
    await deleteButton.click()

    // Confirm deletion if prompted
    const confirm = page.getByRole('button', { name: /confirm|yes|delete/i })
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirm.click()
    }

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 8_000 })
  })
})
