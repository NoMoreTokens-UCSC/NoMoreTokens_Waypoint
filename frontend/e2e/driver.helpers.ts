import { expect, type Page } from '@playwright/test'
import type { Settings, Snapshot } from '../src/domain/models'

export const deliveryPhoto = {
  name: 'delivery.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=',
    'base64',
  ),
}

/** Driver-only fixture starts after the upstream Loader/Dispatcher handoff. */
export async function clearedDriverLoad(page: Page) {
  await page.goto('/driver/home')
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()
  await page.evaluate(async () => {
    const request = indexedDB.open('waypoint-operations-v1')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('snapshots', 'readwrite')
    const store = transaction.objectStore('snapshots')
    const read = store.get('workspace')
    read.onsuccess = () => {
      const record = read.result as { id: string; data: Omit<Snapshot, 'queue'> }
      record.data.settings.published = true
      record.data.settings.routeStarted = false
      const load = record.data.loads.find((item) => item.vehicleId === 'VEH055')!
      load.completed = true
      load.released = true
      load.photoId = 'upstream-fixture-photo'
      load.checks = { refrigeration: true, condition: true, restraints: true }
      for (const item of load.items) item.loaded = item.expected
      store.put(record)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
  await page.reload()
  await expect(page.getByText('Loaded and cleared', { exact: true })).toBeVisible()
}

export async function driverScenario(page: Page, settings: Partial<Settings>) {
  await page.evaluate(async (changes) => {
    const request = indexedDB.open('waypoint-operations-v1')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('snapshots', 'readwrite')
    const store = transaction.objectStore('snapshots')
    const read = store.get('workspace')
    read.onsuccess = () => {
      const record = read.result as { id: string; data: Omit<Snapshot, 'queue'> }
      Object.assign(record.data.settings, changes)
      store.put(record)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  }, settings)
  // An external IndexedDB connection need not notify Dexie's live-query broadcaster.
  await page.reload()
}

export async function startAndPark(page: Page) {
  await clearedDriverLoad(page)
  await page.getByRole('link', { name: 'Before-you-leave check' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Confirm and start route' }).click()
  await expect(page).toHaveURL(/\/driver\/route$/)
  await page.getByRole('link', { name: 'Open turn-by-turn demo' }).click()
  await page.getByRole('button', { name: 'Confirm I’ve parked' }).click()
  await expect(page.getByRole('heading', { name: 'Arrived and safely parked' })).toBeVisible()
}

export async function captureAndReview(page: Page) {
  await page.getByRole('link', { name: 'Capture delivery photo' }).click()
  await page.getByLabel('Choose delivery photograph').setInputFiles(deliveryPhoto)
  await expect(page.getByRole('heading', { name: 'Is everything clearly visible?' })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('img', { name: 'Delivery photograph saved on this device' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Delivery photograph saved on this device' })
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await signManagerHandoff(page)
  await page.getByRole('button', { name: 'Continue to submission review' }).click()
  await expect(page.getByRole('heading', { name: 'Check the handoff.' })).toBeVisible()
}

export async function drawManagerSignature(page: Page) {
  const canvas = page.getByLabel('Store Manager signature', { exact: true })
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.4)
  await page.mouse.down()
  for (let index = 1; index <= 10; index++)
    await page.mouse.move(
      box.x + box.width * (0.15 + index * 0.055),
      box.y + box.height * (index % 2 ? 0.65 : 0.35),
    )
  await page.mouse.up()
  await expect(page.getByText('Signature captured for these handoff details.')).toBeVisible()
}
export async function signManagerHandoff(
  page: Page,
  remarks = 'All cases unloaded, checked and received in good condition.',
) {
  await page.getByLabel('Store Manager name', { exact: true }).fill('Nimal Perera')
  await page.getByLabel('Store Manager remarks', { exact: true }).fill(remarks)
  await page.getByRole('checkbox').check()
  await drawManagerSignature(page)
}

export async function confirmProof(page: Page, offline = false) {
  await page
    .getByRole('button', { name: offline ? 'Save with photo offline' : 'Submit delivery proof' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm submission' }).click()
  await expect(page).toHaveURL(/\/driver\/sync\?stop=/)
}

export async function storedDriverState(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('waypoint-operations-v1')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction(
      ['snapshots', 'queue', 'evidence', 'driverProofDrafts'],
      'readonly',
    )
    const workspace = transaction.objectStore('snapshots').get('workspace')
    const queue = transaction.objectStore('queue').getAll()
    const evidence = transaction.objectStore('evidence').getAll()
    const drafts = transaction.objectStore('driverProofDrafts').getAll()
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    const record = workspace.result as { data: Omit<Snapshot, 'queue'> }
    return {
      vehicle: record.data.vehicles.find((vehicle) => vehicle.id === 'VEH055'),
      positions: record.data.pendingPositions ?? [],
      notices: record.data.deliveryNotices ?? [],
      statuses: record.data.stops.map((stop) => stop.status),
      receipts: record.data.orders.map((order) => order.receipt),
      queue: queue.result.map(
        (entry: { status: string; evidenceId: string; revision: number }) => entry,
      ),
      evidence: evidence.result.map(
        (entry: {
          id: string
          accepted: boolean
          revision: number
          photo: Blob
          signature?: Blob
          managerSignOff?: { remarks: string; photoDigest: string }
        }) => ({
          id: entry.id,
          accepted: entry.accepted,
          revision: entry.revision,
          size: entry.photo.size,
          signatureSize: entry.signature?.size ?? 0,
          remarks: entry.managerSignOff?.remarks,
          photoDigest: entry.managerSignOff?.photoDigest,
        }),
      ),
      drafts: drafts.result.length,
    }
  })
}
