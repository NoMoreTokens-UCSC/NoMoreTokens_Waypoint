import { expect, test } from '@playwright/test'

test('home retains reference alignment across mobile, tablet and desktop widths', async ({
  page,
}) => {
  for (const width of [360, 390, 768, 834, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/welcome')
    const row = page.locator('[data-layer="StepsRow"]')
    await expect(row.locator('[data-layer="StepCircle"]')).toHaveCount(4)
    const circles = await row.locator('[data-layer="StepCircle"]').all()
    const boxes = await Promise.all(circles.map((circle) => circle.boundingBox()))
    for (let i = 1; i < boxes.length; i++) {
      if (width >= 768) {
        expect(Math.abs(boxes[i]!.y - boxes[0]!.y)).toBeLessThan(1)
        expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x + 44)
      } else {
        expect(Math.abs(boxes[i]!.x - boxes[0]!.x)).toBeLessThan(1)
        expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y + 44)
      }
    }
    if (width >= 768) {
      const copy = (await page.locator('[data-layer="MorningRushCopy"]').boundingBox())!
      const photo = (await page.locator('[data-layer="MorningRushPhoto"]').boundingBox())!
      expect(copy.width).toBeCloseTo(width / 2, 0)
      expect(photo.x).toBeCloseTo(width / 2, 0)
      const cards = page.locator('[data-layer="FeatureCards"] > [data-layer^="ContentCard/"]')
      const first = (await cards.nth(0).boundingBox())!
      const second = (await cards.nth(1).boundingBox())!
      expect(second.y).toBeCloseTo(first.y, 0)
      expect(second.height).toBeCloseTo(first.height, 0)
      if (width === 1440) {
        expect((await page.locator('[data-layer="HowItWorks"]').boundingBox())!.y).toBe(1019)
        expect((await page.locator('[data-layer="MorningRush"]').boundingBox())!.y).toBe(2033)
      }
    }
    const stats = page.locator('[data-layer="StatsStrip"]')
    if (await stats.count()) {
      const bounds = (await stats.boundingBox())!
      for (const stat of await stats.locator(':scope > [data-layer="Stat"]').all()) {
        const box = (await stat.boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    if (width >= 768 && width < 1200) {
      expect(
        (await page.locator('[data-layer="BrandColumn"]').boundingBox())!.height,
      ).toBeGreaterThan(40)
      const links = page.locator('[data-layer="LinkColumns"]')
      const bounds = (await links.boundingBox())!
      for (const column of await links.locator(':scope > [data-layer^="Column/"]').all()) {
        const box = (await column.boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      }
    }
  }
})

test('home steps slide into their final alignment and reveal only once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/welcome')
  const steps = page.locator('[data-motion="home-step"]')
  await expect(steps).toHaveCount(4)
  await expect(steps.first()).toHaveAttribute('data-motion-reduced', 'false')
  expect(await steps.first().evaluate((node) => getComputedStyle(node).opacity)).toBe('0')
  await page.locator('[data-layer="HowItWorks"]').scrollIntoViewIfNeeded()
  for (const step of await steps.all()) {
    await expect(step).toHaveCSS('opacity', '1')
    await expect(step).toHaveCSS('transform', 'none')
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(steps.last()).toHaveCSS('opacity', '1')
  await page.locator('[data-layer="CoreFeatures"]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-layer="CoreFeatures"]')).toHaveCSS('transform', 'none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440)
})

test('animated popups retain input, dismissal and viewport fit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/driver/route')
  const trigger = page.getByRole('button', { name: 'MenuButton', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  const reveal = dialog.locator('[data-motion="popup"]')
  await expect(reveal).toHaveAttribute('data-motion-reduced', 'false')
  await expect(reveal).toHaveCSS('opacity', '1')
  await expect(reveal).toHaveCSS('transform', 'none')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Forgot?', exact: true }).click()
  const recovery = page.getByRole('dialog')
  await expect(recovery).toHaveCSS('opacity', '1')
  await recovery.getByRole('textbox').fill('EMP042')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(recovery.getByRole('textbox')).toHaveValue('EMP042')
  await page.keyboard.press('Escape')
  await expect(recovery).not.toBeVisible()
})

test('reduced motion shows home text and forms without sliding', async ({ page }) => {
  await page.goto('/welcome')
  const steps = page.locator('[data-motion="home-step"]')
  await expect(steps).toHaveCount(4)
  for (const step of await steps.all()) {
    await expect(step).toHaveAttribute('data-motion-reduced', 'true')
    await expect(step).toHaveCSS('opacity', '1')
    await expect(step).toHaveCSS('transform', 'none')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/driver/route')
  await page.getByRole('button', { name: 'MenuButton', exact: true }).click()
  const popup = page.getByRole('dialog').locator('[data-motion="popup"]')
  await expect(popup).toHaveAttribute('data-motion-reduced', 'true')
  await expect(popup).toHaveCSS('transform', 'none')
})
