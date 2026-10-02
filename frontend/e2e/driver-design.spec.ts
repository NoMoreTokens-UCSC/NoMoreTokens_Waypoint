import { test, expect } from '@playwright/test'

test('missing receiver signature requires a note for Other and updates its indicator', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/driver/route?frame=322%3A21095')
  await page.getByRole('button', { name: 'Other Add a short note', exact: true }).click()
  const note = page.getByRole('textbox', { name: 'Missing signature note' })
  await expect(note).toBeVisible()
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
  await expect(page.getByText('Add a short note explaining the missing signature.')).toBeVisible()
  await note.fill('Receiver requested contactless delivery')
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
  await expect(
    page.getByText('Other: Receiver requested contactless delivery', { exact: true }),
  ).toBeVisible()
})

test('route loading state advances after its source delay', async ({ page }) => {
  await page.goto('/driver/route?frame=72%3A797')
  await expect(page).toHaveURL(/frame=7%3A28/)
  await expect(
    page.getByRole('heading', { name: 'Collect your next load', exact: true }),
  ).toBeVisible()
})
