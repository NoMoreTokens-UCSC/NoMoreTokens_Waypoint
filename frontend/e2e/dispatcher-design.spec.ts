import { test, expect } from '@playwright/test'

test('queue search closes row gaps and clearing restores the source list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  await page.goto('/dispatcher/orders')
  const first = page.getByText(/^ORD1042 \u00b7 OUT001$/)
  await expect(first).toBeVisible()
  const firstY = (await first.boundingBox())!.y
  await page
    .getByRole('textbox', { name: 'Search orders, outlets or vehicles', exact: true })
    .fill('ORD1058')
  const result = page.getByText(/^ORD1058 \u00b7 OUT032$/)
  await expect(result).toBeVisible()
  expect(Math.abs((await result.boundingBox())!.y - firstY)).toBeLessThan(1)
  await expect(page.getByText(/^ORD1042 \u00b7 OUT001$/)).toHaveCount(0)
  await page
    .getByRole('textbox', { name: 'Search orders, outlets or vehicles', exact: true })
    .fill('')
  await expect(page.getByText(/^ORD1042 \u00b7 OUT001$/)).toBeVisible()
})
