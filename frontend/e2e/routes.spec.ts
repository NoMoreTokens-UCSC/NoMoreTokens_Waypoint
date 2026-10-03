import { test, expect } from '@playwright/test'
import { mockMapTiles } from './map.helpers'

test.beforeEach(async ({ page }) => mockMapTiles(page))

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
  '/store-manager/orders/new',
  '/store-manager/notifications',
  '/store-manager/profile',
  '/store-manager/settings',
  '/store-manager/orders/ORD0910',
  '/store-manager/orders/ORD0906',
  '/store-manager/deliveries',
  '/store-manager/alerts',
  '/store-manager/orders/review',
  '/store-manager/orders/confirmed',
  '/store-manager/orders/draft',
  '/store-manager/deliveries/ORD1042/receipt',
  '/store-manager/deliveries/ORD1042/receipt/confirmed',
  '/store-manager/deliveries/ORD1042/issue',
  '/store-manager/deliveries/ORD1042/issue/submitted',
  '/loader/queue',
  '/loader/loading',
  '/loader/proof',
  '/driver/home',
  '/driver/route',
  '/driver/delivery',
  '/driver/issues',
  '/driver/pre-departure',
  '/driver/route/details',
  '/driver/navigation',
  '/driver/arrival',
  '/driver/proof/capture',
  '/driver/proof/camera-unavailable',
  '/driver/proof/review',
  '/driver/proof/attached',
  '/driver/proof/submit',
  '/driver/delivered',
  '/driver/offline',
  '/driver/sync',
  '/driver/route/revision',
  '/driver/sync/history',
  '/driver/history',
  '/store-manager/deliveries/confirm',
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
  await expect(page).toHaveURL(/\/store-manager\/overview$/)
})

test('breadcrumbs name the page, link home and go back', async ({ page }) => {
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  const current = crumbs.locator('[aria-current="page"]')
  const sidebar = page.getByRole('navigation', { name: 'Workspace navigation' })
  await page.goto('/loader/queue')
  await expect(current).toHaveText('Home')
  await sidebar.getByRole('link', { name: 'Load workspace' }).click()
  await expect(current).toHaveText('Load workspace')
  await crumbs.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(/\/loader\/queue$/)
  await sidebar.getByRole('link', { name: 'Loading proof' }).click()
  await crumbs.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL(/\/loader\/queue$/)
  // Opened directly, Back has nowhere to return to and goes to the role's home.
  await page.goto('/dispatcher/fleet')
  await crumbs.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(/\/dispatcher\/orders$/)
})
