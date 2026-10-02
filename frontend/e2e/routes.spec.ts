import { test, expect } from '@playwright/test'

// Keep in step with the module definitions in src/presentation/sections/*/index.ts.
const routes = [
  '/welcome',
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

test('legacy entry paths redirect to the workspace chooser', async ({ page }) => {
  for (const path of ['/login', '/how-it-works']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/welcome$/)
  }
})
