import { test, expect } from '@playwright/test'

for (const viewport of [
  { width: 390, height: 844 },
  { width: 834, height: 1112 },
  { width: 1440, height: 1024 },
]) {
  test(`source Store creation, review, confirmation and reload at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/store-manager/overview')
    await page.getByRole('button', { name: 'Create orders', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'chilled:Cases' }).fill('19')
    await page.getByRole('spinbutton', { name: 'chilled:Weight · kg' }).fill('125')
    await page.getByRole('button', { name: 'Review 2 orders', exact: true }).click()
    await expect(page.getByText('19 cases · 125 kg · 1.2 m³', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Confirm 2 orders', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Orders confirmed/ })).toBeVisible()
    await page.goto('/store-manager/overview')
    await page.reload()
    await expect(page.getByText('19 cases · 125 kg · 1.2 m³', { exact: true })).toBeVisible()
  })
}
