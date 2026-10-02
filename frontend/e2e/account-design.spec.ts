import { test, expect } from '@playwright/test'

test('source shared profile dismisses by keyboard and returns to the workspace', async ({
  page,
}) => {
  await page.goto('/account/profile')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Your profile', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 700 })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('main [data-render-mode="product"]').first()).toHaveAttribute(
    'data-layer',
    /Mobile/,
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('main [data-render-mode="product"]').first()).toHaveAttribute(
    'data-node',
    '196:18656',
  )
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/store-manager\/overview/)
  await expect(page.getByRole('heading', { name: 'Order placement', exact: true })).toBeVisible()
})

test('driver editable contact fields persist without altering managed profile fields', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/driver/home?frame=367%3A21383')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Change photo', exact: true }).click()
  await (
    await chooser
  ).setFiles({
    name: 'profile.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(page.getByAltText('Saved profile photograph')).toBeVisible()
  await page.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('+94 77 112 2334')
  await page.getByRole('textbox', { name: 'Language', exact: true }).fill('Sinhala')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('+94 77 112 2334', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('+94 77 112 2334', { exact: true })).toBeVisible()
  await expect(page.getByText('Sanjeewa Bandara', { exact: true }).first()).toBeVisible()
})
