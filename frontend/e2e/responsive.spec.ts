import { test, expect } from '@playwright/test'

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
  '/store-manager/deliveries',
  '/store-manager/alerts',
  '/loader/queue',
  '/loader/loading',
  '/loader/proof',
  '/driver/home',
  '/driver/route?frame=7%3A28&stop=STOP001',
  '/driver/delivery',
  '/driver/issues',
  '/administration/team',
  '/administration/roles',
  '/administration/audit',
  '/recovery',
]

for (const width of [360, 390, 768, 834, 1024, 1280, 1440, 1920]) {
  test(`product surfaces fill ${width}px without scaling or page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const route of routes) {
      await page.goto(route)
      const root = page.locator('main [data-render-mode="product"]').first()
      await expect(root).toBeVisible()
      const box = (await root.boundingBox())!
      expect(Math.abs(box.width - width), route).toBeLessThan(2)
      expect(box.height, route).toBeGreaterThanOrEqual(900)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        route,
      ).toBeLessThanOrEqual(width + 1)
      expect(await root.evaluate((node) => getComputedStyle(node).transform), route).toBe('none')
      if (route.startsWith('/driver/route'))
        await expect(root).toHaveAttribute(
          'data-node',
          width < 768 ? '7:28' : width < 1200 ? '94:9310' : '94:9194',
        )
      if (route === '/welcome') {
        const footer = root.locator(':scope > [data-layer="Footer"]')
        const bottom = await footer.evaluate(
          (node) => node.getBoundingClientRect().bottom + window.scrollY,
        )
        expect(
          Math.abs((await page.evaluate(() => document.documentElement.scrollHeight)) - bottom),
        ).toBeLessThan(2)
      }
    }
    expect(errors).toEqual([])
  })
}

test('driver menu contains its panel, fits short screens and survives resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/driver/route')
  await page.getByRole('button', { name: 'MenuButton', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('[data-layer="MenuPanel"]')).toBeVisible()
  await expect(
    dialog.locator('[data-layer="Web navigation / Driver · with Home and Profile"]'),
  ).toHaveCount(0)
  const menu = (await dialog.boundingBox())!
  expect(menu.y).toBeGreaterThanOrEqual(8)
  expect(menu.y + menu.height).toBeLessThanOrEqual(585)
  await page.setViewportSize({ width: 1440, height: 700 })
  await expect(dialog).toBeVisible()
  await expect(page.locator('[data-node="94:9194"]').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Collect your next load', exact: true }),
  ).toBeVisible()
})

test('workspace cards retain photos and fleet capacity labels retain their meaning', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/workspaces')
  const cards = page.locator('[data-layer^="ContentCard/"]')
  await expect(cards).toHaveCount(4)
  for (const card of await cards.all()) {
    expect((await card.boundingBox())!.width).toBeGreaterThan(500)
    const photo = card.locator('[data-layer^="Photo /"]')
    expect((await photo.boundingBox())!.width).toBeGreaterThan(200)
    expect(await photo.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(
      '/figma/assets/',
    )
  }
  await page.setViewportSize({ width: 834, height: 900 })
  await page.goto('/dispatcher/fleet')
  const vehicle = page.locator('[data-layer="Vehicle/VEH055"]').first()
  await expect(vehicle.getByText('Volume', { exact: true })).toBeVisible()
  await expect(vehicle.getByText('Weight', { exact: true })).toBeVisible()
  await expect(vehicle.getByText('En Route', { exact: true })).toHaveCount(1)
})

test('form values and selected workflow step survive mobile, tablet and desktop resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/store-manager/overview')
  await page.getByRole('button', { name: 'Create orders', exact: true }).click()
  const cases = page.getByRole('spinbutton', { name: 'chilled:Cases' })
  await cases.fill('19')
  for (const width of [834, 1440, 360]) {
    await page.setViewportSize({ width, height: 700 })
    await expect(cases).toHaveValue('19')
    await expect(page.getByRole('button', { name: 'Review 2 orders', exact: true })).toBeVisible()
  }
  await page.goto('/driver/home?frame=367%3A21383')
  const phone = page.getByRole('textbox', { name: 'Mobile number', exact: true })
  await phone.fill('+94 77 112 2334')
  for (const width of [1024, 1920, 390]) {
    await page.setViewportSize({ width, height: 700 })
    await expect(phone).toHaveValue('+94 77 112 2334')
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible()
  }
})

test('tablet planning stays readable and every roles column remains reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 600 })
  await page.goto('/dispatcher/planning')
  const demand = (await page.locator('[data-layer="ConfirmedDemandPane"]').boundingBox())!
  const trips = (await page.locator('[data-layer="VehicleTripsPane"]').boundingBox())!
  expect(trips.y).toBeGreaterThanOrEqual(demand.y + demand.height)
  expect(trips.width).toBeGreaterThan(400)
  await page.goto('/administration/roles')
  const matrix = page.locator('[data-layer="RolesMatrix"]')
  expect(await matrix.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
  await matrix.evaluate((node) => {
    node.scrollLeft = node.scrollWidth
  })
  expect(await matrix.evaluate((node) => node.scrollLeft)).toBeGreaterThan(500)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768)
})

test('zoom-equivalent CSS viewport retains readable controls', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1152, height: 720 },
    deviceScaleFactor: 1.25,
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/dispatcher/fleet')
  await expect(page.getByRole('heading', { name: 'Fleet', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1152)
  await context.close()
})

test('source steps, small icons and login error layouts keep their intended geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/welcome')
  const steps = page.locator('[data-layer="StepsRow"]')
  await expect(steps.locator('[data-layer="StepCircle"]')).toHaveCount(4)
  await expect(steps.getByText('Order', { exact: true })).toBeVisible()
  await expect(steps.getByText('Deliver', { exact: true })).toBeVisible()
  const cards = page.locator('[data-layer="FeatureCards"] > [data-layer^="ContentCard/"]')
  const firstCard = (await cards.nth(0).boundingBox())!
  const nextCard = (await cards.nth(1).boundingBox())!
  expect(nextCard.y - firstCard.y - firstCard.height).toBeLessThanOrEqual(24)
  await page.goto('/demo/responsive/433%3A21919')
  const icon = (await page.locator('[data-layer="SuccessMark"]').boundingBox())!
  expect(icon.width).toBe(48)
  expect(icon.height).toBe(48)
  for (const width of [360, 768, 1024]) {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/demo/responsive/2029%3A22952')
    await expect(page.locator('[data-render-mode="product"]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    )
  }
})

test('secondary desktop-only states adapt their panels, toolbars and table columns', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 700 })
  await page.goto('/demo/responsive/137%3A17728')
  const demand = page.locator('[data-layer="DemandDetails"]')
  const requirements = page.locator('[data-layer="AllocationRequirements"]')
  await expect(demand).toBeVisible()
  const first = (await demand.boundingBox())!
  const second = (await requirements.boundingBox())!
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
  expect(first.width).toBeGreaterThan(260)
  await expect(page.locator('[data-layer="GlobalSearch"] [data-layer="Placeholder"]')).toHaveCSS(
    'white-space',
    'nowrap',
  )
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/demo/responsive/137%3A17713')
    const table = page.locator('[data-layer="OrderQueueTable"]')
    await expect(table).toBeVisible()
    expect(await table.evaluate((node) => node.scrollWidth)).toBeGreaterThan(1100)
    await table.evaluate((node) => {
      node.scrollLeft = node.scrollWidth
    })
    expect(await table.evaluate((node) => node.scrollLeft)).toBeGreaterThan(500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  }
  await page.goto('/dispatcher/fleet')
  const list = page.locator('[data-layer="ScrollableCardList"]')
  await list.locator(':scope > [data-layer^="Vehicle/"]').last().scrollIntoViewIfNeeded()
  expect(await list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  expect(await list.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
})
