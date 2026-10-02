import { test, expect } from '@playwright/test'

// Keep in step with the module definitions in src/presentation/sections/*/index.ts.
const routes = [
  '/welcome',
  '/how-it-works',
  '/login',
  '/workspaces',
  '/dispatcher/orders',
  '/dispatcher/planning',
  '/dispatcher/deferrals',
  '/dispatcher/review',
  '/dispatcher/release',
  '/dispatcher/fleet',
  '/dispatcher/tracking',
  '/dispatcher/analytics',
  '/store-manager/overview',
  '/store-manager/orders',
  '/store-manager/deliveries',
  '/store-manager/alerts',
  '/loader/queue',
  '/loader/loading',
  '/loader/proof',
  '/loader/loading/LOAD055-1',
  '/loader/proof/LOAD055-1',
  '/loader/loading/missing',
  '/driver/home',
  '/driver/route',
  '/driver/delivery',
  '/driver/issues',
  '/administration/team',
  '/administration/roles',
  '/administration/assignments',
  '/administration/audit',
  '/account/profile',
  '/account/settings',
  '/account/notifications',
  '/recovery',
  '/recovery/review',
]

for (const [width, height] of [
  [390, 844],
  [834, 1112],
  [1440, 1024],
] as const) {
  test(`every route renders a native screen at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('h1').first(), route).toBeVisible()
      await expect(page.getByText('We couldn’t open this screen.')).toHaveCount(0)
      await expect(page.getByText('Workspace could not be opened')).toHaveCount(0)
      await expect(page.getByText('Screen not found')).toHaveCount(0)
      await expect(page.locator('[data-node]')).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${route} scrolls horizontally`,
      ).toBeLessThanOrEqual(width + 1)
    }
    expect(errors).toEqual([])
  })
}

test('the root opens the welcome page and leads to sign-in and workspaces', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByRole('link', { name: 'Log in' }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password')
  await page.getByLabel('Email or employee ID').fill('nimal@example.test')
  await page.getByLabel('Password').fill('demo-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/workspaces$/)
  await page.getByRole('link', { name: /Store manager/ }).click()
  await expect(page).toHaveURL(/\/store-manager\/orders$/)
})
