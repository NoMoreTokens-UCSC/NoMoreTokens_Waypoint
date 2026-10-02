import { test, expect, type Page } from '@playwright/test'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR9sAAAAASUVORK5CYII=',
  'base64',
)
async function scenario(
  page: Page,
  change: (dialog: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  const returnUrl = page.url()
  await page.goto('/demo')
  const dialog = page.getByRole('dialog', { name: 'Demo scenarios' })
  await change(dialog)
  await expect(dialog.getByText('Scenario settings saved', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto(returnUrl)
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1024 },
]) {
  test(`shared handoff, proof recovery and store receipt at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 })
    await page.goto('/dispatcher/orders')
    await scenario(page, async (d) => {
      await d.getByRole('switch', { name: 'Intake cutoff passed' }).click()
      await expect(d.getByRole('switch', { name: 'Intake cutoff passed' })).toBeChecked()
    })
    await page.getByRole('button', { name: 'Start allocation', exact: true }).click()
    await page.getByRole('button', { name: 'Review allocation', exact: true }).click()
    await page.getByRole('button', { name: 'Publish plan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Plan published', exact: true })).toBeVisible()
    await page.goto('/dispatcher/release')
    await expect(page.getByRole('button', { name: 'Refresh readiness', exact: true })).toBeVisible()
    await page.setViewportSize(viewport)
    await page.goto('/loader/loading')
    await page.getByRole('button', { name: /Confirm OUT008/ }).click()
    await page.getByRole('button', { name: /Confirm OUT001/ }).click()
    if (viewport.width === 1440) {
      await page.getByRole('button', { name: 'Confirm all 18 loaded', exact: true }).click()
      for (const name of [
        'Refrigeration working',
        'Goods condition checked',
        'Restraints secured',
      ]) {
        await page.getByRole('button', { name: new RegExp(name) }).click()
      }
      await page.getByRole('button', { name: 'Attach loading photo', exact: true }).click()
    } else {
      await page.getByRole('button', { name: 'Confirm all safety checks', exact: true }).click()
      await page.getByRole('button', { name: 'Take loading photo', exact: true }).click()
    }
    const chooser = page.waitForEvent('filechooser')
    await page
      .getByRole('button', {
        name: viewport.width === 1440 ? 'Take loading photo' : 'Capture photo',
        exact: true,
      })
      .click()
    await (await chooser).setFiles({ name: 'load-proof.png', mimeType: 'image/png', buffer: png })
    await page.setViewportSize({ width: viewport.width === 390 ? 1440 : 390, height: 700 })
    await expect(page.getByRole('button', { name: 'Use this photo', exact: true })).toBeVisible()
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Use this photo', exact: true }).click()
    if (viewport.width === 1440)
      await page.getByRole('button', { name: 'Review loading completion', exact: true }).click()
    await page.getByRole('button', { name: 'Mark loading complete', exact: true }).click()
    if (viewport.width !== 1440)
      await page.getByRole('button', { name: 'Confirm loading complete', exact: true }).click()
    await expect(page.getByText('Loading complete', { exact: true }).first()).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1024 })
    await page.goto('/dispatcher/release')
    await expect(page.getByText('210 / 800 kg · 2.0 / 4.0 m³', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Dispatch VEH055 · Trip 1', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Dispatch VEH055 · Trip 1', exact: true }),
    ).toHaveCount(0)
    await scenario(page, async (d) => {
      await d.getByRole('switch', { name: 'Simulate offline' }).click()
      await expect(d.getByRole('switch', { name: 'Simulate offline' })).toBeChecked()
    })
    await page.setViewportSize(viewport)
    await page.goto('/driver/home')
    await page.getByRole('button', { name: 'Start route', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm and start route', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm I’ve parked', exact: true }).click()
    await page.getByRole('button', { name: 'Complete Delivery', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Cases delivered', exact: true }).fill('18')
    await page.getByRole('button', { name: 'Continue to photo', exact: true }).click()
    const deliveryChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Capture photo', exact: true }).click()
    await (
      await deliveryChooser
    ).setFiles({ name: 'delivery.png', mimeType: 'image/png', buffer: png })
    await page.setViewportSize({ width: viewport.width === 390 ? 1440 : 390, height: 700 })
    await expect(page.getByRole('button', { name: 'Use this photo', exact: true })).toBeVisible()
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Use this photo', exact: true }).click()
    await page.getByRole('textbox', { name: 'Receiver name', exact: true }).fill('Thilini Silva')
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
    await page.getByRole('button', { name: 'Submit proof', exact: true }).click()
    await expect(
      page.getByText('Photo saved. Sync pending.', { exact: true }).first(),
    ).toBeVisible()
    await page.goto('/recovery')
    await page.reload()
    await expect(page.getByText('Saved on this phone', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/^Thilini Silva \u00b7/)).toBeVisible()
    await expect(page.getByText(/^ORD1042 \u00b7 1 KB \u00b7/)).toBeVisible()
    await page.getByRole('button', { name: /Delivery photo/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await scenario(page, async (d) => {
      await d.getByLabel('Demo sync outcome').selectOption('retry')
      await d.getByRole('switch', { name: 'Simulate offline' }).click()
      await expect(d.getByRole('switch', { name: 'Simulate offline' })).not.toBeChecked()
    })
    await page.getByRole('button', { name: 'Retry upload', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Retry now', exact: true })).toBeVisible()
    await scenario(page, async (d) => {
      await d.getByLabel('Demo sync outcome').selectOption('accepted')
      await d.getByRole('button', { name: 'Route changed while offline' }).click()
    })
    await page.getByRole('button', { name: 'Retry now', exact: true }).click()
    await page.getByRole('button', { name: 'Review updated route', exact: true }).click()
    await page.getByRole('button', { name: 'Review updated route', exact: true }).click()
    await page.getByRole('button', { name: 'Accept revised instructions', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto('/recovery')
    await page.getByRole('button', { name: 'Retry upload', exact: true }).click()
    await expect(page.getByText('All records synced', { exact: true }).first()).toBeVisible()
    await page.goto('/store-manager/deliveries')
    await page.getByRole('button', { name: /Refresh delivery status/ }).click()
    await page.getByRole('button', { name: 'Confirm receipt', exact: true }).click()
    await page.getByRole('button', { name: /Confirm all .* cases received/ }).click()
    await expect(page.getByText('Receipt confirmed', { exact: true }).first()).toBeVisible()
  })
}

test('production PWA reloads offline and opens cached routes', async ({ page, context }) => {
  await page.goto('/dispatcher/orders')
  await expect(page.getByRole('heading', { name: 'Order queue', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Order queue', exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await page.goto('/driver/route')
  await expect(
    page.getByRole('heading', { name: 'Collect your next load', exact: true }),
  ).toBeVisible()
  await expect(page.locator('[data-missing-asset]')).toHaveCount(0)
  await context.setOffline(false)
})

test('all primary routes render, and representative layouts fit each viewport', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const routes = [
    '/welcome',
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
  ]
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('main [data-node]').first()).toBeVisible()
    await expect(page.getByText('We couldn’t open this screen.')).toHaveCount(0)
    await expect(page.getByText('Workspace could not be opened')).toHaveCount(0)
  }
  for (const [section, route, width, height] of [
    ['dispatcher', '/dispatcher/orders', 1440, 1024],
    ['store', '/store-manager/orders', 1440, 1024],
    ['loader', '/loader/loading', 1024, 768],
    ['driver', '/driver/home', 390, 844],
    ['admin', '/administration/team', 1440, 1024],
    ['recovery', '/recovery', 390, 844],
    ['dispatcher-mobile', '/dispatcher/orders', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(route)
    await expect(page.locator('main [data-node]').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
    await page.screenshot({ path: testInfo.outputPath(`${section}.png`), fullPage: true })
  }
  await page.goto('/demo')
  await expect(page.getByRole('dialog', { name: 'Demo scenarios' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/workspaces/)
  expect(errors).toEqual([])
})
