import { test, expect, type Page } from '@playwright/test'

type Stage = 'scheduled' | 'delivered'
const stageLabel: Record<Stage, string> = {
  scheduled: 'Scheduled · one order deferred',
  delivered: 'Delivered · receipt pending',
}

/**
 * The dispatcher, loader and driver steps that move an order along are other roles' screens, so
 * these tests use the demo panel's "Store orders" control to put the store's orders in the state
 * those steps would leave them in.
 */
async function seed(page: Page, stage: Stage) {
  await page.goto('/demo')
  await page.getByLabel('Store orders').selectOption({ label: stageLabel[stage] })
  await expect(page.getByText('Store orders updated').first()).toBeVisible()
}
const clearStorage = (page: Page) => page.addInitScript(() => sessionStorage.clear())

test.describe('store manager', () => {
  test('places two separate orders: create, review, confirm', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/overview')
    await expect(page.getByText('18 minutes to place tomorrow’s orders')).toBeVisible()
    await page.getByRole('link', { name: 'Create orders' }).click()
    await expect(page.getByRole('heading', { name: 'Create orders' })).toBeVisible()
    const chilled = page.getByRole('region', { name: 'Fresh · Chilled' })
    // Set the count with the stepper, then correct the estimated weight and volume by hand.
    await chilled.getByRole('button', { name: 'Add one case' }).click()
    await chilled.getByRole('button', { name: 'Add one case' }).click()
    await chilled.getByLabel('Weight · kg').fill('130')
    await chilled.getByLabel('Volume · m³').fill('1.3')
    // Pick the window from the From and To lists; nothing is typed.
    await chilled.getByLabel('From').selectOption({ label: '6:00 AM' })
    await chilled.getByLabel('To').selectOption({ label: '8:00 AM' })
    await expect(chilled.getByText('6:00 AM to 8:00 AM · 2 hours')).toBeVisible()
    await expect(page.getByText('Combined weight · 370 kg')).toBeVisible()
    await page.getByRole('button', { name: 'Review 2 orders' }).click()
    await expect(page.getByRole('heading', { name: 'Review & confirm' })).toBeVisible()
    await expect(page.getByText('20 cases · 130 kg · 1.3 m³')).toBeVisible()
    await expect(page.getByText('06:00–08:00').first()).toBeVisible()
    await page.getByRole('button', { name: 'Confirm 2 orders' }).click()
    await expect(page.getByRole('heading', { name: 'Orders confirmed' })).toBeVisible()
    await expect(page.getByText('Awaiting allocation').first()).toBeVisible()
    // The confirmed quantities are what the overview shows afterwards, even after a reload.
    await page.goto('/store-manager/overview')
    await page.reload()
    await expect(page.getByText('20 cases · 130 kg · 1.3 m³')).toBeVisible()
    await expect(page.getByText('Window 06:00–08:00').first()).toBeVisible()
  })

  test('weight and volume follow the cases until they are edited', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders')
    const dry = page.getByRole('region', { name: 'Fresh · Dry' })
    await dry.getByRole('button', { name: 'Add one case' }).click()
    await expect(dry.getByLabel('Weight · kg')).toHaveValue('250')
    await expect(dry.getByLabel('Volume · m³')).toHaveValue('2.5')
    await dry.getByLabel('Weight · kg').fill('260')
    await dry.getByRole('button', { name: 'Add one case' }).click()
    await expect(dry.getByLabel('Weight · kg')).toHaveValue('260')
    await expect(dry.getByText('Weight and volume are as you entered them.')).toBeVisible()
  })

  test('receiving windows can only be chosen within the Fresh rules', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders')
    const dry = page.getByRole('region', { name: 'Fresh · Dry' })
    const from = dry.getByLabel('From')
    const to = dry.getByLabel('To')
    // Wait for the page to render before reading the lists; reading options does not wait.
    await expect(to).toHaveValue('08:00')
    const labels = (select: typeof from) => select.locator('option').allTextContents()
    // Times read in 12-hour form. Fresh goods must arrive before 8:00 AM, with an hour to unload.
    expect((await labels(from)).at(0)).toBe('4:00 AM')
    expect((await labels(from)).at(-1)).toBe('7:00 AM')
    expect((await labels(to)).at(-1)).toBe('8:00 AM')
    await from.selectOption({ label: '7:00 AM' })
    await expect(to).toHaveValue('08:00')
    expect(await labels(to)).toEqual(['8:00 AM'])
    // A new start keeps the length of the window (one hour here).
    await from.selectOption({ label: '5:00 AM' })
    await expect(to).toHaveValue('06:00')
    await expect(dry.getByText('5:00 AM to 6:00 AM · 1 hour')).toBeVisible()
  })

  test('chilled is optional: a dry-only day is one order', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders')
    await page.getByRole('switch', { name: 'Order chilled groceries for this delivery' }).click()
    await expect(page.getByText('No change to your chilled order ORD1042')).toBeVisible()
    // The switched-off card must not stretch its content (the tag once became a tall circle).
    const tag = page.getByRole('region', { name: 'Fresh · Chilled' }).getByText('Chilled groceries')
    expect((await tag.boundingBox())!.height).toBeLessThan(40)
    const off = page.getByRole('region', { name: 'Fresh · Chilled' })
    const on = page.getByRole('region', { name: 'Fresh · Dry' })
    expect((await off.boundingBox())!.height).toBeLessThan((await on.boundingBox())!.height)
    await expect(page.getByRole('button', { name: 'Review 1 order' })).toBeVisible()
    await page.getByRole('button', { name: 'Review 1 order' }).click()
    await expect(page.getByText('1 Fresh order')).toBeVisible()
    await expect(page.getByText('Not included: Fresh · Chilled')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm 1 order' }).click()
    await expect(page.getByRole('heading', { name: 'Orders confirmed' })).toBeVisible()
    await page.goto('/store-manager/orders')
    await page.getByRole('switch', { name: 'Order dry groceries for this delivery' }).click()
    await page.getByRole('switch', { name: 'Order chilled groceries for this delivery' }).click()
    await expect(page.getByRole('button', { name: 'Choose an order to place' })).toBeDisabled()
  })

  test('says what an order made offline means', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/demo')
    await page.getByRole('switch', { name: 'Simulate offline' }).click()
    await expect(page.getByRole('switch', { name: 'Simulate offline' })).toBeChecked()
    await page.goto('/store-manager/orders')
    await expect(page.getByText('You’re offline')).toBeVisible()
    await expect(
      page.getByText(/Dispatch cannot see it until your connection returns/),
    ).toBeVisible()
  })

  test('each order on the overview shows where it stands', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/overview')
    await expect(page.getByText('Awaiting allocation')).toHaveCount(2)
    await seed(page, 'scheduled')
    await page.goto('/store-manager/overview')
    await expect(page.getByText('Scheduled')).toBeVisible()
    await expect(page.getByText('Deferred')).toBeVisible()
  })

  test('after the cutoff the order is kept as a draft for the next run', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/demo')
    await page.getByRole('switch', { name: 'Intake cutoff passed' }).click()
    await expect(page.getByRole('switch', { name: 'Intake cutoff passed' })).toBeChecked()
    await page.goto('/store-manager/orders')
    await expect(page.getByRole('heading', { name: 'Today’s cutoff has passed' })).toBeVisible()
    await expect(page.getByText('Saturday’s intake is locked')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm for Saturday' })).toBeDisabled()
    await page.getByRole('button', { name: 'Keep draft for Monday' }).click()
    await expect(page.getByRole('heading', { name: 'Draft saved for next run' })).toBeVisible()
    await expect(page.getByText('42 cases · 360 kg · 3.6 m³')).toBeVisible()
    await expect(page.getByText('Monday, 28 September')).toBeVisible()
  })

  test('a deferral must be acknowledged before it clears', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'scheduled')
    await page.goto('/store-manager/overview')
    await expect(page.getByRole('link', { name: /Notifications, 1 new/ })).toBeVisible()
    await page.goto('/store-manager/alerts')
    await expect(page.getByRole('heading', { name: 'Delivery deferred' })).toBeVisible()
    await expect(page.getByText('Insufficient Volume Capacity')).toBeVisible()
    const acknowledge = page.getByRole('button', { name: 'Acknowledge deferral' })
    await expect(acknowledge).toBeDisabled()
    await page.getByLabel('I understand this order is deferred to the next run.').check()
    await acknowledge.click()
    await expect(page.getByRole('heading', { name: 'Deferral acknowledged' })).toBeVisible()
    await expect(page.getByText('Acknowledgment recorded')).toBeVisible()
    await expect(page.getByRole('link', { name: /Notifications, \d new/ })).toHaveCount(0)
  })

  test('shows the outlet on a real map before the plan is published', async ({ page }) => {
    await page.goto('/store-manager/deliveries')
    await expect(page.getByText('Awaiting allocation').first()).toBeVisible()
    const map = page.getByRole('region', { name: 'Route' }).locator('.leaflet-container')
    await expect(map).toBeVisible()
    await expect(map.locator('.leaflet-marker-icon')).toHaveCount(1)
    await expect(page.getByText('The route and vehicle appear after dispatch')).toBeVisible()
  })

  test('tracks a scheduled delivery', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'scheduled')
    await page.goto('/store-manager/deliveries')
    await expect(page.getByRole('heading', { name: 'Delivery tracking' })).toBeVisible()
    await expect(page.getByText('Planned arrival')).toBeVisible()
    await expect(page.getByText('Ready by 05:30')).toBeVisible()
    const map = page.getByRole('region', { name: 'Route' }).locator('.leaflet-container')
    await expect(map).toBeVisible()
    // Depot, outlet and the assigned vehicle, with the route drawn between them.
    await expect(map.locator('.leaflet-marker-icon')).toHaveCount(3)
    await expect(map.locator('path.leaflet-interactive')).toHaveCount(1)
    await expect(page.getByText('1 order deferred · View alert')).toBeVisible()
  })

  test('confirms receipt of a delivered order', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'delivered')
    await page.goto('/store-manager/deliveries')
    await expect(page.getByRole('heading', { name: 'Delivered · Confirm receipt' })).toBeVisible()
    await page.getByRole('link', { name: 'Confirm receipt' }).click()
    await expect(page.getByText('Did all 18 cases arrive in good condition?')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm all 18 cases received' }).click()
    await expect(page.getByRole('heading', { name: 'Receipt confirmed' })).toBeVisible()
    await expect(page.getByText('All 18 cases received.')).toBeVisible()
    await page.getByRole('button', { name: 'View delivery photograph' }).click()
    await expect(page.getByRole('dialog', { name: 'Delivery photograph' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('reports missing items with counts that add up', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'delivered')
    await page.goto('/store-manager/deliveries/ORD1042/issue')
    await expect(page.getByRole('heading', { name: 'Report a delivery issue' })).toBeVisible()
    await page.getByLabel('Cases received · required').fill('16')
    await page.getByLabel('Missing cases · required').fill('5')
    await page.getByLabel('What happened · required').fill('Cases were not on the vehicle.')
    await page.getByRole('button', { name: 'Submit missing-item report' }).click()
    await expect(
      page.getByText('Received and missing cases must add up to the 18 ordered.'),
    ).toBeVisible()
    await page.getByLabel('Missing cases · required').fill('2')
    await expect(page.getByText('16 received · 2 missing · 18 expected')).toBeVisible()
    await page.getByRole('button', { name: 'Submit missing-item report' }).click()
    await expect(page.getByRole('heading', { name: 'Issue submitted' })).toBeVisible()
    await expect(page.getByText('Missing-item report received.')).toBeVisible()
    await expect(page.getByText('ISS-1042-M')).toBeVisible()
    await expect(page.getByText('16 received · 2 missing').first()).toBeVisible()
  })

  test('the navigation menu replaces the sidebar on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/store-manager/overview')
    await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeHidden()
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const menu = page.getByRole('dialog')
    await expect(menu.getByRole('link', { name: 'Delivery tracking' })).toBeVisible()
    await menu.getByRole('link', { name: 'Alerts' }).click()
    await expect(page).toHaveURL(/\/store-manager\/alerts$/)
  })
})
