import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { readFileSync } from 'node:fs'

const photo = {
  name: 'dock-proof.png',
  mimeType: 'image/png',
  buffer: readFileSync(new URL('./fixtures/Goods.png', import.meta.url)),
}

async function publish(page: Page) {
  await page.goto('/dispatcher/planning')
  await page.getByRole('button', { name: 'Propose allocations' }).click()
  await expect(
    page.getByText('Allocation proposed. Review the checks before publishing.', { exact: true }),
  ).toBeVisible()
  await page.goto('/demo')
  await page.getByRole('switch', { name: 'Intake cutoff passed' }).click()
  await expect(page.getByRole('switch', { name: 'Intake cutoff passed' })).toBeChecked()
  await page.goto('/dispatcher/review')
  await page.getByRole('button', { name: 'Confirm allocation review', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Publish plan', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Publish plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plan published', exact: true })).toBeVisible()
}

async function reconcile(page: Page) {
  for (const [outlet, quantity] of [
    ['OUT008', 14],
    ['OUT001', 18],
  ] as const) {
    await page.getByRole('button', { name: `Confirm ${quantity}`, exact: true }).click()
    await expect(page.getByLabel(`${outlet} cases loaded`)).toHaveValue(String(quantity))
  }
  for (const name of [
    'Refrigeration working for chilled goods',
    'Goods condition checked',
    'Restraints secured and stop order checked',
  ]) {
    await page.getByRole('checkbox', { name, exact: true }).click()
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeChecked()
  }
  await expect(page.getByLabel('Choose evidence photograph')).toBeEnabled()
}

async function savePhoto(page: Page) {
  await page.getByLabel('Choose evidence photograph').setInputFiles(photo)
  await expect(page.getByAltText('Selected photograph preview')).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByAltText('Selected photograph preview')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Save photograph', exact: true }).click()
  await expect(page.getByAltText('Saved operational evidence')).toBeVisible()
  await expect(page.getByText(/Saved on this device · dock-proof.png/)).toBeVisible()
}

async function screenshot(page: Page, info: TestInfo, state: string) {
  const smallTargets = await page
    .locator(
      '.loader-page button, .loader-page input:not([type="file"]), .loader-page .upload-control',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
        })
        .map((element) => element.getAttribute('aria-label') ?? element.textContent),
    )
  expect(smallTargets).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  )
  await page.screenshot({ path: info.outputPath(`${state}.png`), fullPage: true })
}

for (const [width, height] of [
  [390, 844],
  [834, 1194],
  [1440, 1024],
] as const) {
  test(`Loader published-to-release flow at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    await publish(page)
    await page.goto('/loader/queue')
    const links = page.locator('.loader-queue-row a')
    await expect.poll(() => links.count()).toBeGreaterThan(1)
    await screenshot(page, info, 'queue')
    await page.locator('a[href="/loader/loading/LOAD055-1"]').click()
    await expect(
      page.getByRole('heading', { name: 'Loading workspace', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Confirm loading complete', exact: true }),
    ).toBeDisabled()
    await screenshot(page, info, 'loading')
    await reconcile(page)
    await page.getByRole('button', { name: 'Camera unavailable?', exact: true }).click()
    await expect(page.getByText(/If access is denied or this device has no camera/)).toBeVisible()
    await savePhoto(page)
    await screenshot(page, info, 'proof')
    await page.getByRole('button', { name: 'Confirm loading complete', exact: true }).click()
    await expect(
      page.getByText('Loading complete · awaiting Dispatcher release', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Dispatch VEH/ })).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByText('Loading complete · awaiting Dispatcher release', { exact: true }),
    ).toBeVisible()
    await screenshot(page, info, 'complete')
    await page.goto('/dispatcher/release?loadId=LOAD055-1')
    await page.getByRole('button', { name: 'Dispatch VEH055 · Trip 1', exact: true }).click()
    await expect(page.getByText('Vehicle released for departure', { exact: true })).toBeVisible()
    await page.goto('/loader/loading/LOAD055-1')
    await expect(page.getByText('Vehicle has departed', { exact: true })).toBeVisible()
    await expect(page.getByLabel('OUT001 cases loaded')).toBeDisabled()
    await screenshot(page, info, 'released')
    await page.goto('/driver/route')
    await expect(page.getByRole('heading', { name: /OUT/ })).toHaveCount(0)
    await expect(page.getByText('OUT057', { exact: true })).toHaveCount(0)
  })

  for (const kind of ['Missing', 'Damaged']) {
    test(`${kind} report and revision review at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height })
      await publish(page)
      await page.goto('/loader/loading/LOAD055-1')
      await reconcile(page)
      await savePhoto(page)
      await page.getByRole('button', { name: 'Report an issue', exact: true }).click()
      await page.getByLabel('Delivery stop', { exact: true }).selectOption('OUT001')
      await page.getByLabel('Issue type', { exact: true }).selectOption(kind)
      await page.getByLabel('Affected cases', { exact: true }).fill('1')
      await page
        .getByLabel('Item and issue description', { exact: true })
        .fill('One milk case affected')
      await page.getByRole('button', { name: 'Report and hold load', exact: true }).click()
      await expect(
        page.getByText('Load held · awaiting Dispatcher decision', { exact: true }),
      ).toBeVisible()
      await expect(page.getByAltText('Saved operational evidence')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: /replacement approved|Approve replacement/ }),
      ).toHaveCount(0)
      await screenshot(page, info, 'held')
      await page.goto('/dispatcher/release?loadId=LOAD055-1')
      await page
        .getByRole('button', { name: 'Approve replacement and revise load', exact: true })
        .click()
      await expect(
        page.getByText('Shortfall requires Dispatcher decision', { exact: true }),
      ).toHaveCount(0)
      await page.goto('/loader/loading/LOAD055-1')
      await expect(
        page.getByText('Review changed instructions · Revision 4', { exact: true }),
      ).toBeVisible()
      await expect(page.getByLabel('OUT001 cases loaded')).toBeDisabled()
      await screenshot(page, info, 'revision-review')
      await page
        .getByRole('button', { name: 'Acknowledge revised instructions', exact: true })
        .click()
      await expect(page.getByLabel('OUT001 cases loaded')).toBeEnabled()
      await expect(page.getByLabel('OUT001 cases loaded')).toHaveValue('0')
      await reconcile(page)
      await savePhoto(page)
      await expect(
        page.getByText(/Saved on this device · dock-proof.png · Revision 4/),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Confirm loading complete', exact: true }).click()
      await expect(
        page.getByText('Loading complete · awaiting Dispatcher release', { exact: true }),
      ).toBeVisible()
    })
  }
}

test('selected loads, unavailable routes and legacy URLs', async ({ page }) => {
  await publish(page)
  await page.goto('/loader/queue')
  await expect(page.locator('.loader-queue-row a').nth(1)).toBeVisible()
  const second = await page.locator('.loader-queue-row a').nth(1).getAttribute('href')
  await page.goto(second!)
  await expect(page).toHaveURL(new RegExp(second! + '$'))
  await expect(page.getByRole('heading', { name: 'Loading workspace', exact: true })).toBeVisible()
  await expect(page.getByText(/VEH055 · Trip 1 · Revision/)).toHaveCount(0)
  await page.reload()
  await expect(page).toHaveURL(new RegExp(second! + '$'))
  await page.goto('/loader/loading/missing')
  await expect(page.getByRole('heading', { name: 'Load unavailable', exact: true })).toBeVisible()
  for (const route of ['/loader/loading', '/loader/proof']) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/loader\/queue$/)
  }
})

test('photo validation, replacement and local saving while offline', async ({ page, context }) => {
  await publish(page)
  await page.goto('/loader/loading/LOAD055-1')
  await reconcile(page)
  await page.getByLabel('Choose evidence photograph').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a photograph'),
  })
  await expect(
    page.getByRole('alert').filter({ hasText: 'Use a JPEG, PNG, or WebP photo up to 10 MB.' }),
  ).toBeVisible()
  await page.getByLabel('Choose evidence photograph').setInputFiles(photo)
  await expect(page.getByAltText('Selected photograph preview')).toBeVisible()
  await page.getByRole('button', { name: 'Discard photo', exact: true }).click()
  await expect(page.getByAltText('Selected photograph preview')).toHaveCount(0)
  await savePhoto(page)
  await page
    .getByLabel('Choose evidence photograph')
    .setInputFiles({ ...photo, name: 'replacement.png' })
  await expect(page.getByAltText('Selected photograph preview')).toBeVisible()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'evidence') {
        IDBObjectStore.prototype.put = original
        throw new DOMException('Photo storage is full. Retry saving.', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Save photograph', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /Photo storage is full/ })).toBeVisible()
  await expect(page.getByAltText('Selected photograph preview')).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText('Offline · saved on this device', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save photograph', exact: true }).click()
  await expect(page.getByText(/Saved on this device · replacement.png/)).toBeVisible()
  await expect(page.locator('.photo-capture [role="alert"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm loading complete', exact: true }).click()
  await expect(
    page.getByText('Loading complete · awaiting Dispatcher release', { exact: true }),
  ).toBeVisible()
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText(/Saved on this device · replacement.png/)).toBeVisible()
  await expect(
    page.getByText('Loading complete · awaiting Dispatcher release', { exact: true }),
  ).toBeVisible()
})
