import { expect, test } from '@playwright/test'
import {
  clearedDriverLoad,
  captureAndReview,
  confirmProof,
  deliveryPhoto,
  driverScenario,
  signManagerHandoff,
  startAndPark,
  storedDriverState,
} from './driver.helpers'
import { mockMapTiles } from './map.helpers'

test.beforeEach(async ({ page }) => mockMapTiles(page))

test('Driver navigation follows arrival and proof stages on a small mobile screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await clearedDriverLoad(page)
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  const menu = page.getByRole('dialog')
  await expect(menu.getByRole('link', { name: /Delivery proof/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(menu.getByRole('link', { name: 'Route history', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.keyboard.press('Escape')
  await startAndPark(page)
  await page.goto('/driver/route')
  await expect(page.getByRole('heading', { name: 'Your next delivery' })).toBeVisible()
  const nextOutlet = await page.getByRole('heading', { name: 'Your next delivery' }).boundingBox()
  const map = await page.getByRole('region', { name: 'Driver route map' }).boundingBox()
  expect(nextOutlet!.y).toBeLessThan(map!.y)
  await page.goto('/driver/arrival?stop=STOP001')
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(menu.getByRole('link', { name: 'Delivery proof', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await menu.getByRole('link', { name: 'Delivery proof', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Delivery progress' })).toContainText(
    'Arrived & parked',
  )
  await expect(
    page.getByRole('list', { name: 'Delivery progress' }).locator('[aria-current="step"]'),
  ).toHaveText(/Arrived & parked/)
  await page.getByRole('link', { name: 'Capture delivery photo' }).click()
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await expect(page.getByText('Await Store Manager confirmation', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Cases delivered')).toHaveCount(0)
  await page.getByRole('button', { name: 'Manager signs on this device' }).click()
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [667, 375],
    [834, 1112],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    const input = await page.getByLabel('Store Manager name', { exact: true }).boundingBox()
    expect(input?.height).toBeGreaterThanOrEqual(44)
    const signature = await page
      .getByLabel('Store Manager signature', { exact: true })
      .boundingBox()
    expect(signature?.width).toBeLessThan(width)
  }
})

test('manager confirms quantities, remarks and signature in their workspace without another receipt action', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await startAndPark(page)
  await page.getByRole('link', { name: 'Capture delivery photo' }).click()
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await expect(page).toHaveURL(/\/proof\/attached\?stop=/)
  await page.goto('/store-manager/deliveries')
  await page.getByRole('link', { name: 'Review & confirm handoff' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm delivery handoff' })).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Driver delivery photo for manager review' }),
  ).toBeVisible()
  await signManagerHandoff(page, 'All 18 cases received and checked by the store manager.')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page).toHaveURL(/review=1/)
  await page.reload()
  await page.getByRole('button', { name: 'Confirm delivery receipt' }).click()
  await expect(page).toHaveURL(/\/store-manager\/deliveries$/)
  await expect(
    page.getByText('Manager confirmation is already recorded', { exact: false }),
  ).toBeVisible()
  const saved = await storedDriverState(page)
  expect(saved.statuses[0]).toBe('Delivered')
  expect(saved.evidence[0].signatureSize).toBeGreaterThan(0)
  expect(saved.routeEvents.map((event) => event.kind)).toEqual([
    'started',
    'arrived',
    'proofSaved',
    'accepted',
  ])
  await page.goto('/driver/route')
  await expect(page.getByRole('heading', { name: 'OUT008 · Fresh Kelaniya' })).toBeVisible()
  await page.goto('/store-manager/deliveries/confirm?stop=STOP008')
  await expect(
    page.getByRole('heading', { name: 'No delivery assigned to this outlet' }),
  ).toBeVisible()
})

test('breakdown records an updated late ETA and persists daily history while leaving delivery open', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-03T06:10:00+05:30'))
  await startAndPark(page)
  await page.goto('/driver/issues?stop=STOP008')
  await page.getByLabel('Issue type').selectOption('Vehicle breakdown')
  await page
    .getByLabel('Delay details')
    .fill('Engine failure; awaiting a replacement truck from dispatch.')
  await page.getByLabel('Revised estimated arrival').fill('08:20')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Save breakdown report' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm issue record' }).click()
  await expect(page.getByText('Delay saved locally', { exact: true })).toBeVisible()
  await page.goto('/driver/route')
  await expect(page.getByRole('list', { name: 'Ordered delivery outlets' })).toContainText(
    '08:20 · Driver estimate',
  )
  await page.goto('/driver/navigation?stop=STOP008')
  await expect(
    page.getByText('Driver estimate misses the delivery window', { exact: true }),
  ).toBeVisible()
  await page.goto('/driver/history')
  await expect(page.getByRole('list', { name: 'Route activity timeline' })).toContainText(
    'Vehicle breakdown · OUT008',
  )
  await page.reload()
  await expect(page.getByLabel('Route day')).toHaveValue('2026-10-03')
  await expect(page.getByRole('list', { name: 'Route activity timeline' })).toContainText('08:20')
  expect((await storedDriverState(page)).statuses[1]).toBe('Upcoming')
})

test('manager contacts open on demand and remain usable without internet', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await startAndPark(page)
  await page.context().setOffline(true)
  await expect(page.getByRole('link', { name: /Call Nimal/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Contact outlet manager' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: /Call Nimal/ })).toHaveAttribute('href', /^tel:/)
  await expect(dialog.getByRole('link', { name: 'Prepare SMS' })).toHaveAttribute('href', /^sms:/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Contact outlet manager' })).toBeFocused()
})

test('offline route moves to the next outlet and proof navigation follows its arrival', async ({
  page,
}) => {
  await startAndPark(page)
  await driverScenario(page, { simulatedOffline: true })
  await captureAndReview(page)
  await confirmProof(page, true)
  await page.goto('/driver/route')
  await expect(page.getByRole('heading', { name: 'OUT008 · Fresh Kelaniya' })).toBeVisible()
  await page.getByRole('link', { name: 'Open turn-by-turn demo' }).click()
  await page.getByRole('button', { name: 'Confirm I’ve parked' }).click()
  await expect(page).toHaveURL(/\/driver\/arrival\?stop=STOP008/)
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('link', { name: 'Delivery proof', exact: true })
    .click()
  await expect(page).toHaveURL(/\/driver\/arrival\?stop=STOP008/)
  expect((await storedDriverState(page)).statuses).toEqual(['Proof pending', 'Arrived'])
})
