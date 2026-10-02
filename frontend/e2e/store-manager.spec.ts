import { test, expect, type Page } from '@playwright/test'

type Stage = 'scheduled' | 'late' | 'delivered'
const stageLabel: Record<Stage, string> = {
  scheduled: 'Scheduled · one order deferred',
  late: 'En route · running late',
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
    await page.goto('/store-manager/orders/new')
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
    await page.goto('/store-manager/orders/new')
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
    await page.goto('/store-manager/orders/new')
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
    await page.goto('/store-manager/orders/new')
    await page.getByRole('switch', { name: 'Order dry groceries for this delivery' }).click()
    await page.getByRole('switch', { name: 'Order chilled groceries for this delivery' }).click()
    await expect(page.getByRole('button', { name: 'Choose an order to place' })).toBeDisabled()
  })

  test('says what an order made offline means', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/demo')
    await page.getByRole('switch', { name: 'Simulate offline' }).click()
    await expect(page.getByRole('switch', { name: 'Simulate offline' })).toBeChecked()
    await page.goto('/store-manager/orders/new')
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
    await page.goto('/store-manager/orders/new')
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

  test('orders lists the next delivery and every earlier order', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders')
    await expect(page.getByRole('heading', { name: /Next delivery/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Tuesday, 22 September' })).toContainText(
      'ORD0910',
    )
    await page.getByRole('button', { name: 'Needs attention' }).last().click()
    await expect(page.getByText('ORD0910')).toBeVisible()
    await expect(page.getByText('ORD0901')).toHaveCount(0)
    await page.getByRole('link', { name: /ORD0910/ }).click()
    await expect(page.getByRole('heading', { name: 'Order ORD0910' })).toBeVisible()
    await expect(page.getByText('ISS-0910-M')).toBeVisible()
    await expect(page.getByText('16 received · 2 missing')).toBeVisible()
  })

  test('a deferred earlier order shows its reason and acknowledgment', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders/ORD0906')
    await expect(page.getByText('Deferred to the next run')).toBeVisible()
    await expect(page.getByText('Insufficient Volume Capacity')).toBeVisible()
    await expect(page.getByText(/You acknowledged this/)).toBeVisible()
  })

  test('search finds earlier orders', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/overview')
    // Wait for the page and its data, or the typed text is lost when the page finishes loading.
    await expect(page.getByText('Awaiting allocation')).toHaveCount(2)
    await page.getByPlaceholder('Search orders, deliveries or issues').fill('ORD0903')
    await page
      .getByRole('link', { name: /ORD0903/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/store-manager\/orders\/ORD0903$/)
  })

  test('the order list can be searched and paged', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders')
    await expect(page.getByText('Page 1 of 2')).toBeVisible()
    await expect(page.getByText('ORD0913')).toHaveCount(1)
    await expect(page.getByText('ORD0901')).toHaveCount(0)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    await expect(page.getByText('ORD0901')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
    // A search starts again from the first page and needs no paging when it is short.
    await page.getByLabel('Search orders').fill('issue')
    await expect(page.getByText('ORD0910')).toBeVisible()
    await expect(page.getByText('ORD0903')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Order pages' })).toHaveCount(0)
    await page.getByLabel('Search orders').fill('nothing like this')
    await expect(page.getByRole('heading', { name: 'No orders here' })).toBeVisible()
  })

  const setOffline = async (page: Page, offline: boolean) => {
    await page.goto('/demo')
    const toggle = page.getByRole('switch', { name: 'Simulate offline' })
    if ((await toggle.isChecked()) !== offline) await toggle.click()
    if (offline) await expect(toggle).toBeChecked()
    else await expect(toggle).not.toBeChecked()
  }

  test('orders made offline wait to send, then go out when the connection returns', async ({
    page,
  }) => {
    await clearStorage(page)
    await setOffline(page, true)
    await page.goto('/store-manager/orders/new')
    await page.getByRole('button', { name: 'Review 2 orders' }).click()
    await page.getByRole('button', { name: 'Confirm 2 orders' }).click()
    await expect(page.getByText('Saved on this device, not sent yet')).toBeVisible()
    await expect(page.getByText('1 change waiting to send')).toBeVisible()
    await expect(page.getByText('Confirm 2 Fresh orders')).toBeVisible()
    // Dispatch has not received them: the shared data is unchanged, the store sees them as waiting.
    await page.getByRole('link', { name: 'Orders', exact: true }).first().click()
    await expect(page.getByText('Waiting to send').first()).toBeVisible()
    await setOffline(page, false)
    await page.goto('/store-manager/overview')
    await expect(page.getByText('waiting to send')).toHaveCount(0)
    await expect(page.getByText('Awaiting allocation')).toHaveCount(2)
  })

  test('a receipt confirmed offline is sent later', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'delivered')
    await setOffline(page, true)
    await page.goto('/store-manager/deliveries/ORD1042/receipt')
    await page.getByRole('button', { name: 'Confirm all 18 cases received' }).click()
    await expect(page.getByRole('heading', { name: 'Receipt confirmed' })).toBeVisible()
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible()
    await expect(page.getByText('1 change waiting to send')).toBeVisible()
    await setOffline(page, false)
    await page.goto('/store-manager/orders/ORD1042')
    await expect(page.getByText('waiting to send')).toHaveCount(0)
    await expect(page.getByText('Receipt confirmed').first()).toBeVisible()
  })

  test('the store has its own notifications, profile and preferences', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'delivered')
    await page.goto('/store-manager/overview')
    // The bell and the account menu open the store's pages, not the shared ones.
    await page.getByRole('link', { name: /^Notifications/ }).click()
    await expect(page).toHaveURL(/\/store-manager\/notifications$/)
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
    const needs = page.getByRole('region', { name: 'Needs your action' })
    await expect(needs.getByText('ORD1042 was delivered')).toBeVisible()
    // Issues reported earlier, with where they stand.
    const issues = page.getByRole('region', { name: 'Issues you reported' })
    await expect(issues.getByText('ISS-0910-M · Missing items')).toBeVisible()
    await expect(issues.getByText('Open · Awaiting review').first()).toBeVisible()
    // The activity feed filters.
    await page.getByRole('button', { name: 'Issues' }).click()
    const activity = page.getByRole('region', { name: 'Activity' })
    await expect(activity.getByText('Missing items reported').first()).toBeVisible()
    await expect(activity.getByText('Order placed')).toHaveCount(0)
    await page.getByRole('button', { name: 'Your account' }).click()
    await page.getByRole('menuitem', { name: 'Profile' }).click()
    await expect(page).toHaveURL(/\/store-manager\/profile$/)
    await expect(page.getByText('Store manager').first()).toBeVisible()
    await expect(page.getByText('OUT001').first()).toBeVisible()
    await expect(
      page.getByText('Fresh goods must arrive before the store opens at 8:00 AM'),
    ).toBeVisible()
    await page.goto('/store-manager/settings')
    await expect(page.getByRole('heading', { name: 'Saved on this device' })).toBeVisible()
    await expect(page.getByText('Everything has been sent.')).toBeVisible()
  })

  test('warns when the vehicle is expected after the receiving window', async ({ page }) => {
    await clearStorage(page)
    await seed(page, 'late')
    await page.goto('/store-manager/deliveries')
    await expect(
      page.getByText('Expected 55 minutes after your window closes').first(),
    ).toBeVisible()
    await expect(page.getByText('now expected at 08:25')).toBeVisible()
    await expect(page.getByText('Running late').first()).toBeVisible()
    await page.goto('/store-manager/overview')
    await expect(page.getByText('Running late')).toBeVisible()
    // The bell counts the late delivery and the unacknowledged deferral.
    await expect(page.getByRole('link', { name: /Notifications, 2 new/ })).toBeVisible()
    await page.goto('/store-manager/notifications')
    await expect(
      page.getByRole('region', { name: 'Running late' }).getByText(/ORD1042 is expected/),
    ).toBeVisible()
    // An on-time delivery shows none of this.
    await seed(page, 'scheduled')
    await page.goto('/store-manager/deliveries')
    await expect(page.getByText('Running late')).toHaveCount(0)
  })

  test('an order can be cancelled until the cutoff, then it is locked', async ({ page }) => {
    await clearStorage(page)
    await page.goto('/store-manager/orders/ORD1042')
    await page.getByRole('button', { name: 'Cancel order' }).click()
    await expect(page.getByText('Cancel order ORD1042?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep order' }).click()
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel order' }).click()
    await page.getByRole('button', { name: 'Yes, cancel order' }).click()
    await expect(page).toHaveURL(/\/store-manager\/orders$/)
    await expect(page.getByText('ORD1042')).toHaveCount(0)
    await expect(page.getByText('ORD1043').first()).toBeVisible()
    // After the cutoff the remaining order is locked.
    await page.goto('/demo')
    await page.getByRole('switch', { name: 'Intake cutoff passed' }).click()
    await expect(page.getByRole('switch', { name: 'Intake cutoff passed' })).toBeChecked()
    await page.goto('/store-manager/orders/ORD1043')
    await expect(page.getByText('This order is locked')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  })

  const signInAs = async (page: Page, outlet: string) => {
    await page.goto('/demo')
    await page.getByLabel('Store outlet').selectOption({ label: outlet })
    await expect(page.getByText('Store workspace switched').first()).toBeVisible()
  }

  test('a Style outlet places one weekly order inside its mall window', async ({ page }) => {
    await clearStorage(page)
    await signInAs(page, 'OUT016 · Style Liberty Mall · Style')
    await page.goto('/store-manager/overview')
    await expect(page.getByRole('region', { name: 'Style · Garments' })).toContainText('20 cartons')
    await expect(page.getByRole('region', { name: 'Fresh · Chilled' })).toHaveCount(0)
    await page.goto('/store-manager/orders/new')
    await expect(page.getByRole('heading', { name: 'Weekly order' })).toBeVisible()
    const from = page.getByLabel('From')
    const to = page.getByLabel('To')
    await expect(from).toBeVisible()
    // Only times inside the mall's 5:30 AM to 9:00 AM access window are offered.
    const labels = (select: typeof from) => select.locator('option').allTextContents()
    expect((await labels(from)).at(0)).toBe('5:30 AM')
    expect((await labels(to)).at(-1)).toBe('9:00 AM')
    await page.getByRole('button', { name: 'Add one carton' }).click()
    await page.getByRole('button', { name: /Confirm 21 cartons order/ }).click()
    await expect(page.getByRole('heading', { name: 'Orders confirmed' })).toBeVisible()
    await expect(page.getByText('Your Style order is confirmed')).toBeVisible()
    await page.goto('/store-manager/orders')
    await expect(page.getByText('21 cartons').first()).toBeVisible()
    await page.goto('/store-manager/profile')
    await expect(page.getByText('Waypoint Style')).toBeVisible()
    await expect(page.getByText('mall only accepts deliveries')).toBeVisible()
  })

  test('a Tech outlet orders a single fragile item and must confirm receiving staff', async ({
    page,
  }) => {
    await clearStorage(page)
    await signInAs(page, 'OUT019 · Tech Kandy City · Tech')
    await page.goto('/store-manager/orders/new')
    await expect(page.getByText('Fragile and high value')).toBeVisible()
    await page.getByRole('button', { name: /Confirm \d+ items? order/ }).click()
    await expect(
      page.getByText('Confirm that staff will be there to inspect and sign.'),
    ).toBeVisible()
    await page.getByLabel('Staff will be available to inspect and sign for the delivery.').check()
    await page.getByRole('button', { name: /Confirm \d+ items? order/ }).click()
    await expect(page.getByRole('heading', { name: 'Orders confirmed' })).toBeVisible()
    await expect(page.getByText('Your Tech order is confirmed')).toBeVisible()
  })
})
