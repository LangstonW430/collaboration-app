import { type Page, expect } from '@playwright/test'

export const TEST_USERS = {
  alice: {
    email: process.env.E2E_USER1_EMAIL ?? 'alice@collabdocs.test',
    password: process.env.E2E_USER1_PASSWORD ?? 'Test1234!',
  },
  bob: {
    email: process.env.E2E_USER2_EMAIL ?? 'bob@collabdocs.test',
    password: process.env.E2E_USER2_PASSWORD ?? 'Test1234!',
  },
} as const

export async function signIn(
  page: Page,
  credentials: { email: string; password: string }
) {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'My Documents' })).toBeVisible()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL('**/auth/login', { timeout: 10_000 })
}

export async function signUp(
  page: Page,
  credentials: { email: string; password: string }
) {
  await page.goto('/auth/signup')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByLabel('Confirm password').fill(credentials.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}
