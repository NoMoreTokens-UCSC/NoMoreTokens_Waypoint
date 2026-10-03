import { test, expect } from '@playwright/test'
import { mockMapTiles } from './map.helpers'
import {
  startAndPark,
  captureAndReview,
  confirmProof,
  driverScenario,
  storedDriverState,
  deliveryPhoto,
  clearedDriverLoad,
  signManagerHandoff,
  drawManagerSignature,
} from './driver.helpers'

test.beforeEach(async ({ page }) => mockMapTiles(page))

for (const width of [390, 1440]) {
  test(`Driver happy path retains signed proof and records the manager receipt at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const frameRequests: string[] = []
    page.on('request', (request) => {
      if (/\/figma\/(frames|catalog|assets)/.test(request.url())) frameRequests.push(request.url())
    })
    await startAndPark(page)
    await captureAndReview(page)
    await confirmProof(page)
    await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
    await page.getByRole('link', { name: 'View delivered stop' }).click()
    await expect(page.getByRole('heading', { name: 'Delivered with photo' })).toBeVisible()
    const stored = await storedDriverState(page)
    expect(stored.statuses[0]).toBe('Delivered')
    expect(stored.evidence[0].accepted).toBe(true)
    expect(stored.drafts).toBe(0)
    expect(stored.receipts[0]).toBe('Confirmed')
    expect(stored.receipts.filter((receipt) => receipt === 'Confirmed')).toHaveLength(1)
    await page.getByRole('link', { name: 'Continue to next stop' }).click()
    await expect(page).toHaveURL(/stop=STOP008/)
    expect(frameRequests).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0)
  })
}

test('offline proof stays pending, interrupted upload is retained, and explicit retry accepts it', async ({
  page,
}) => {
  await startAndPark(page)
  await driverScenario(page, { simulatedOffline: true, syncOutcome: 'retry' })
  await captureAndReview(page)
  await confirmProof(page, true)
  await expect(
    page.getByRole('heading', { name: 'Proof saved locally · pending sync' }),
  ).toBeVisible()
  await page.reload()
  let stored = await storedDriverState(page)
  expect(stored.statuses[0]).toBe('Proof pending')
  expect(stored.queue[0].status).toBe('pending')
  expect(stored.evidence[0].accepted).toBe(false)
  const saved = stored.evidence[0]
  await driverScenario(page, { simulatedOffline: false })
  await expect(page.getByRole('heading', { name: 'Upload interrupted' })).toBeVisible()
  await driverScenario(page, { syncOutcome: 'accepted' })
  await expect(page.getByRole('button', { name: 'Retry upload' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry upload' }).click()
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  stored = await storedDriverState(page)
  expect(stored.statuses[0]).toBe('Delivered')
  expect(stored.evidence[0]).toMatchObject({ id: saved.id, size: saved.size, accepted: true })
})

test('route revision review preserves the original proof and resumes acknowledgement', async ({
  page,
}) => {
  await startAndPark(page)
  await driverScenario(page, { simulatedOffline: true })
  await captureAndReview(page)
  await confirmProof(page, true)
  const before = await storedDriverState(page)
  await driverScenario(page, { simulatedOffline: false, routeRevision: 4 })
  await expect(page.getByRole('heading', { name: 'Route changed while offline' })).toBeVisible()
  await page.getByRole('link', { name: 'Review updated route' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Accept revision and resume sync' }).click()
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  const after = await storedDriverState(page)
  expect(after.evidence[0]).toMatchObject({
    id: before.evidence[0].id,
    size: before.evidence[0].size,
    revision: 3,
    accepted: true,
  })
  expect(after.queue[0].revision).toBe(4)
})

test('camera recovery and retake require manager sign-off for partial acceptance', async ({
  page,
}) => {
  await startAndPark(page)
  await page.getByRole('link', { name: 'Capture delivery photo' }).click()
  await page.getByRole('link', { name: 'Camera denied or unavailable' }).click()
  await expect(page.getByRole('heading', { name: 'Camera access needed' })).toBeVisible()
  await page.getByRole('link', { name: 'Try camera again or choose a photo' }).click()
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await page.getByRole('link', { name: 'Retake photo' }).click()
  await page
    .getByLabel('Choose delivery photograph')
    .setInputFiles({ ...deliveryPhoto, name: 'retaken.png' })
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await page.getByRole('button', { name: 'Manager signs on this device' }).click()
  await page.getByLabel('Cases delivered').fill('16')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page.getByRole('alert')).toContainText('Explain the quantity difference')
  await page.getByLabel('Quantity or receiver exception').fill('Two cases rejected as damaged.')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page.getByRole('alert')).toContainText('e-signature is required')
  await signManagerHandoff(page, '16 cases received; two damaged cases rejected at unloading.')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
})

test('cannot-deliver evidence sync does not complete the delivery and allows retry', async ({
  page,
}) => {
  await startAndPark(page)
  await page.getByRole('link', { name: 'Something is wrong' }).click()
  await page.getByLabel('Attempt details').fill('Rear dock closed. No receiving team available.')
  await page.getByRole('checkbox').check()
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await page.getByRole('button', { name: 'Save unsuccessful attempt' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm issue record' }).click()
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  expect((await storedDriverState(page)).statuses[0]).toBe('Cannot deliver')
  await page.getByRole('link', { name: 'View saved attempt' }).click()
  await page.getByRole('button', { name: 'Retry delivery stop' }).click()
  await expect(page.getByRole('button', { name: 'Confirm I’ve parked' })).toBeEnabled()
})

test('actual browser offline mode preserves proof through refresh and resumes on reconnect', async ({
  page,
  context,
}) => {
  await startAndPark(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await captureAndReview(page)
  await page.reload()
  await expect(page.getByRole('img', { name: 'Retained Store Manager e-signature' })).toBeVisible()
  await confirmProof(page, true)
  await expect(
    page.getByRole('heading', { name: 'Proof saved locally · pending sync' }),
  ).toBeVisible()
  expect((await storedDriverState(page)).statuses[0]).toBe('Proof pending')
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  expect((await storedDriverState(page)).statuses[0]).toBe('Delivered')
})

test('Driver layouts keep controls accessible at 360–1440px and protect unsynced drafts on sign-out', async ({
  page,
}) => {
  await startAndPark(page)
  for (const width of [360, 390, 834, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of [
      '/driver/home',
      '/driver/route',
      '/driver/navigation?stop=STOP001',
      '/driver/proof/capture?stop=STOP001',
      '/driver/issues?stop=STOP001',
    ]) {
      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.getByText('Opening your saved route…')).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        route,
      ).toBeLessThanOrEqual(width)
      await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0)
      const images = await page
        .locator('.driver-screen img:not(.leaflet-tile)')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const img = element as HTMLImageElement
            return img.complete && img.naturalWidth > 0
          }),
        )
      expect(images.every(Boolean), route).toBe(true)
      if (route !== '/driver/issues?stop=STOP001')
        await page.screenshot({
          path: test
            .info()
            .outputPath(`driver-${route.split('/').at(-1)!.split('?')[0]}-${width}.png`),
          fullPage: true,
        })
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/driver/arrival?stop=STOP001')
  await captureAndReview(page)
  await page.getByRole('button', { name: 'Submit delivery proof' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await storedDriverState(page)).queue).toHaveLength(0)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Log Out', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Saved records need attention')
  await page.getByRole('dialog').getByRole('button', { name: 'Open saved records' }).click()
  await expect(page).toHaveURL(/\/driver\/sync$/)
  expect((await storedDriverState(page)).drafts).toBe(1)
})

test('Driver shares the Dispatcher Leaflet map, fits saved stops and recenters after zoom', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/dispatcher/tracking')
  await expect(page.locator('.operations-map.leaflet-container')).toBeVisible()
  const delayedVehicle = page.locator('.operations-map path[fill="#c63a2f"]')
  await expect(delayedVehicle).toHaveCount(1)
  await delayedVehicle.click()
  await expect(page.getByRole('dialog', { name: 'VEH027' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Forecast delay · after window')
  await page.keyboard.press('Escape')
  await clearedDriverLoad(page)
  await page.goto('/driver/route')
  const map = page.getByRole('region', { name: 'Driver route map' })
  await expect(map.locator('.operations-map.leaflet-container')).toBeVisible()
  await expect(map.locator('.leaflet-tooltip')).toHaveText('OUT001')
  await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible()
  const routeLine = map.locator('.leaflet-overlay-pane path').first()
  await expect(routeLine).toHaveAttribute('d', /M/)
  const initial = await routeLine.getAttribute('d')
  await map.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(() => routeLine.getAttribute('d')).not.toBe(initial)
  const zoomed = await routeLine.getAttribute('d')
  // A change from another workspace refreshes route queries without changing coordinates.
  const updates = await page.context().newPage()
  await updates.goto('/demo')
  await updates.getByRole('switch', { name: 'Simulate offline' }).click()
  await expect(map.getByText('Offline · saved locations', { exact: true })).toBeVisible()
  await expect(routeLine).toHaveAttribute('d', zoomed!)
  await updates.close()
  await map.getByRole('button', { name: 'Recenter route' }).click()
  await expect(routeLine).toHaveAttribute('d', initial!)
  await driverScenario(page, { simulatedOffline: true })
  await expect(
    map.getByText('Offline · saved route and stop locations. Basemap unavailable.'),
  ).toBeVisible()
  await expect(map.locator('.leaflet-tile-pane img')).toHaveCount(0)
  await expect(map.locator('.leaflet-overlay-pane path')).toHaveCount(4)
  await map.getByRole('button', { name: 'Recenter route' }).click()
  expect(errors).toEqual([])
})

test('Driver guards departure, unknown stops and proof steps, and resumes a saved draft', async ({
  page,
}) => {
  await page.goto('/driver/pre-departure')
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Confirm and start route' })).toHaveCount(0)
  await page.goto('/driver/proof/submit?stop=unknown')
  await expect(page.getByRole('heading', { name: 'No assigned stop' })).toBeVisible()
  await clearedDriverLoad(page)
  await page.goto('/driver/proof/capture?stop=STOP001')
  await expect(page.getByText('Confirm you are safely parked before recording proof')).toBeVisible()
  await expect(page.getByLabel('Choose delivery photograph')).toHaveCount(0)
  await startAndPark(page)
  await page.goto('/driver/proof/submit?stop=STOP001')
  await expect(page.getByText('A delivery photograph is required')).toBeVisible()
  await page.getByRole('link', { name: 'Capture delivery photo' }).click()
  await page
    .getByLabel('Choose delivery photograph')
    .setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('Not a photo') })
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG or WebP')
  expect((await storedDriverState(page)).drafts).toBe(0)
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await expect(page).toHaveURL(/\/proof\/review\?stop=STOP001/)
  await page.goto('/driver/proof/submit?stop=STOP001')
  await expect(page).toHaveURL(/\/proof\/review\?stop=STOP001/)
  await page.goto('/driver/route')
  await page.getByRole('link', { name: 'Resume saved proof' }).click()
  await expect(page).toHaveURL(/\/proof\/review\?stop=STOP001/)
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await expect(
    page.getByRole('heading', { name: 'Photo attached · ready to review' }),
  ).toBeVisible()
  await page.goto('/driver/route')
  await page.getByRole('link', { name: 'Resume saved proof' }).click()
  await expect(page).toHaveURL(/\/proof\/attached\?stop=STOP001/)
  expect((await storedDriverState(page)).statuses[0]).toBe('Arrived')
})

test('delay notes survive reload without cancelling the stop or losing its photo draft', async ({
  page,
}) => {
  await startAndPark(page)
  await captureAndReview(page)
  await page.goto('/driver/issues?stop=STOP001')
  await page.getByLabel('Issue type').selectOption('Delay')
  await page
    .getByLabel('Delay details')
    .fill('Receiving bay occupied; waiting safely in parking area.')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Save delay note' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm issue record' }).click()
  await expect(page.getByText('Delay saved locally', { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('Delay: Receiving bay occupied; waiting safely in parking area.'),
  ).toBeVisible()
  const stored = await storedDriverState(page)
  expect(stored.statuses[0]).toBe('Arrived')
  expect(stored.drafts).toBe(1)
  expect(stored.queue).toHaveLength(0)
  await page.getByLabel('Issue type').selectOption('Partial acceptance')
  await page.getByRole('link', { name: 'Continue to quantity and proof' }).click()
  await expect(page).toHaveURL(/\/proof\/attached\?stop=STOP001/)
  await expect(page.getByLabel('Store Manager name', { exact: true })).toHaveValue('Nimal Perera')
})

test('completing both stops ends the trip and does not offer the last stop as the next delivery', async ({
  page,
}) => {
  await startAndPark(page)
  for (const stopId of ['STOP001', 'STOP008']) {
    await captureAndReview(page)
    await confirmProof(page)
    await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
    await page.getByRole('link', { name: 'View delivered stop' }).click()
    if (stopId === 'STOP001') {
      await page.getByRole('link', { name: 'Continue to next stop' }).click()
      await page.getByRole('button', { name: 'Confirm I’ve parked' }).click()
    } else {
      await page.getByRole('link', { name: 'Finish trip · back to home' }).click()
    }
  }
  await expect(page.getByRole('heading', { name: 'Trip complete' })).toBeVisible()
  await page.goto('/driver/route')
  await expect(page.getByRole('heading', { name: 'Trip complete' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open turn-by-turn demo' })).toHaveCount(0)
  const stored = await storedDriverState(page)
  expect(stored.statuses).toEqual(['Delivered', 'Delivered'])
  expect(stored.receipts.filter((receipt) => receipt === 'Confirmed')).toHaveLength(2)
})

test('an accepted attempt remains viewable in history after a successful delivery retry', async ({
  page,
}) => {
  await startAndPark(page)
  await page.goto('/driver/issues?stop=STOP001')
  await page.getByLabel('Attempt details').fill('Original attempt: receiving dock was closed.')
  await page.getByRole('checkbox').check()
  await page
    .getByLabel('Choose delivery photograph')
    .setInputFiles({ ...deliveryPhoto, name: 'original-attempt.png' })
  await page.getByRole('button', { name: 'Save unsuccessful attempt' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm issue record' }).click()
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  await page.getByRole('link', { name: 'View saved attempt' }).click()
  await expect(page.getByRole('button', { name: 'Save unsuccessful attempt' })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry delivery stop' }).click()
  await page.getByRole('button', { name: 'Confirm I’ve parked' }).click()
  await captureAndReview(page)
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  await page.getByRole('link', { name: 'View sync history' }).click()
  await page.getByRole('link', { name: 'View saved attempt' }).click()
  await expect(
    page.getByText('Outlet closed: Original attempt: receiving dock was closed.'),
  ).toBeVisible()
  await expect(page.locator('figcaption')).toHaveText('original-attempt.png')
  await expect(page.getByRole('button', { name: 'Retry delivery stop' })).toHaveCount(0)
  expect((await storedDriverState(page)).statuses[0]).toBe('Delivered')
})

test('changing reviewed handoff details invalidates the signature and persists the replacement', async ({
  page,
}) => {
  await startAndPark(page)
  await captureAndReview(page)
  await page.getByRole('link', { name: 'Edit details' }).click()
  await expect(page.getByText('Signature captured for these handoff details.')).toBeVisible()
  await page
    .getByLabel('Store Manager remarks', { exact: true })
    .fill('Corrected remarks: checked all items again.')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page.getByRole('alert')).toContainText('e-signature is required')
  await drawManagerSignature(page)
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page).toHaveURL(/\/proof\/submit\?stop=/)
  await page.reload()
  const image = page.getByRole('img', { name: 'Retained Store Manager e-signature' })
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  await expect(page.getByText('Corrected remarks: checked all items again.')).toBeVisible()
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  const saved = (await storedDriverState(page)).evidence[0]
  expect(saved.signatureSize).toBeGreaterThan(0)
  expect(saved.photoDigest).toMatch(/^[a-f0-9]{64}$/)
})

test('GPS is opt-in, survives navigation, stops explicitly and retains its last offline fix', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { watches: 0, clears: 0 }
    Object.assign(window, { testGps: state })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (success: PositionCallback) => {
          state.watches++
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 6.981,
              longitude: 79.901,
              accuracy: 9,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
          } as GeolocationPosition)
          return state.watches
        },
        clearWatch: () => {
          state.clears++
        },
      },
    })
  })
  await startAndPark(page)
  expect(
    await page.evaluate(
      () => (window as Window & { testGps: { watches: number } }).testGps.watches,
    ),
  ).toBe(0)
  await page.getByRole('button', { name: 'Start location updates' }).click()
  await expect
    .poll(async () => (await storedDriverState(page)).vehicle?.positionSource)
    .toBe('device')
  await page.getByRole('link', { name: 'Current route', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Stop location updates' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop location updates' }).click()
  expect(
    await page.evaluate(() => (window as Window & { testGps: { clears: number } }).testGps.clears),
  ).toBe(1)
  await driverScenario(page, { simulatedOffline: true })
  const saved = await storedDriverState(page)
  expect(saved.vehicle).toMatchObject({ lat: 6.981, lng: 79.901, positionAccuracy: 9 })
  expect(saved.positions).toHaveLength(1)
  await expect(page.getByText(/Last device fix/)).toBeVisible()
})

test('denied GPS permission keeps the saved route usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (_success: PositionCallback, failure: PositionErrorCallback) => {
          failure({ code: 1, message: 'Denied' } as GeolocationPositionError)
          return 1
        },
        clearWatch: () => {},
      },
    })
  })
  await startAndPark(page)
  await page.getByRole('button', { name: 'Start location updates' }).click()
  await expect(page.getByRole('alert')).toContainText('Location permission was denied')
  await expect(page.getByRole('link', { name: 'Capture delivery photo' })).toBeVisible()
  expect((await storedDriverState(page)).positions).toHaveLength(0)
})

test('store manager sees persistent outlet alerts, acknowledges them and views retained signed proof', async ({
  page,
}) => {
  await startAndPark(page)
  await expect(
    page.getByText('Fresh food must reach the outlet by 08:00.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Contact outlet manager' }).click()
  await expect(page.getByRole('link', { name: /^Call / })).toHaveAttribute('href', /^tel:/)
  await page.keyboard.press('Escape')
  await captureAndReview(page)
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  await page.goto('/store-manager/alerts')
  await expect(page.getByRole('heading', { name: 'Signed delivery recorded' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Driver has arrived' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your delivery is on the way' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Notifications/ })).toHaveAccessibleName(
    /Notifications, [1-9]\d* new/,
  )
  await page.getByRole('button', { name: 'Acknowledge delivery alert' }).first().click()
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /^Notifications/ }).click()
  await expect(page).toHaveURL(/\/store-manager\/notifications$/)
  await expect(page.getByRole('heading', { name: 'Driver has arrived' })).toBeVisible()
  await page.goto('/store-manager/deliveries')
  await page.getByRole('button', { name: 'View driver evidence' }).first().click()
  const image = page.getByRole('img', { name: 'Retained Store Manager e-signature' })
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  await expect(page.getByRole('dialog')).toContainText(
    'All cases unloaded, checked and received in good condition.',
  )
})

test('denying system notifications keeps the persistent store inbox available', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockNotification {
      static permission = 'default'
      static async requestPermission() {
        this.permission = 'denied'
        return 'denied'
      }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: MockNotification })
  })
  await startAndPark(page)
  await page.goto('/store-manager/alerts')
  await page.getByRole('button', { name: 'Enable system notifications' }).click()
  await expect(
    page.getByText('Notifications were denied. Enable them in browser settings.'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Driver has arrived' })).toBeVisible()
})

test('a revised order quantity requires replacement manager sign-off and preserves the original proof', async ({
  page,
}) => {
  await startAndPark(page)
  await driverScenario(page, { simulatedOffline: true })
  await captureAndReview(page)
  await confirmProof(page, true)
  await page.evaluate(async () => {
    const request = indexedDB.open('waypoint-operations-v1')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('snapshots', 'readwrite')
    const store = transaction.objectStore('snapshots'),
      read = store.get('workspace')
    read.onsuccess = () => {
      const record = read.result
      record.data.orders.find((order: { id: string }) => order.id === 'ORD1042').cases = 20
      record.data.stops.find((stop: { id: string }) => stop.id === 'STOP001').cases = 20
      record.data.settings.routeRevision = 4
      record.data.settings.simulatedOffline = false
      store.put(record)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Route changed while offline' })).toBeVisible()
  await expect(
    page.getByText(
      'The order manifest changed. Review received quantities and obtain a new manager signature.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add manager sign-off' }).click()
  await expect(
    page.getByRole('heading', { name: 'Photo attached · ready to review' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Manager signs on this device' }).click()
  await page.getByLabel('Cases delivered').fill('20')
  await signManagerHandoff(page, 'Revised manifest: all 20 cases unloaded and checked.')
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page).toHaveURL(/\/proof\/submit\?stop=/)
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  const saved = await storedDriverState(page)
  expect(saved.queue.map((record: { status: string }) => record.status)).toEqual(
    expect.arrayContaining(['superseded', 'accepted']),
  )
  expect(saved.evidence).toHaveLength(2)
  expect(
    saved.evidence.every((record: { signatureSize: number }) => record.signatureSize > 0),
  ).toBe(true)
  expect(saved.statuses[0]).toBe('Delivered')
})

test('an on-time arrival remains on time when signed proof is submitted after the delivery window', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-03T07:20:00+05:30'))
  await startAndPark(page)
  await captureAndReview(page)
  await page.clock.setFixedTime(new Date('2026-10-03T09:05:00+05:30'))
  await page.reload()
  await expect(
    page.getByText('Arrival recorded after the delivery window', { exact: true }),
  ).toHaveCount(0)
  await confirmProof(page)
  await expect(page.getByRole('heading', { name: 'All records synced' })).toBeVisible()
  await page.getByRole('link', { name: 'View delivered stop' }).click()
  await expect(page.getByRole('heading', { name: 'Delivered with photo' })).toBeVisible()
  await expect(
    page.getByText('Arrival recorded after the delivery window', { exact: true }),
  ).toHaveCount(0)
})
