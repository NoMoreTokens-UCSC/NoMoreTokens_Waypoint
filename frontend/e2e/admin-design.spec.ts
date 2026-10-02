import { test, expect } from '@playwright/test'

test('source administration links, editable invitation, user access and reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  await page.goto('/administration/team')
  await expect(page.getByText('Kasun Fernando', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Roles & access', exact: true }).click()
  await expect(page).toHaveURL(/administration\/roles/)
  await page.getByRole('button', { name: 'Users', exact: true }).click()
  await page.getByRole('button', { name: 'Add user', exact: true }).click()
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Amal Perera')
  await page.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('+94 77 112 2334')
  await page.getByRole('button', { name: 'Send invite', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Invite sent' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Team & access', exact: true }).click()
  await page.reload()
  await expect(page.getByText('Amal Perera', { exact: true })).toBeVisible()
})

test('mobile role-first invitation keeps contact step and completion separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/administration/team')
  await page.getByRole('button', { name: 'Add user', exact: true }).click()
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Amal Perera')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('+94 77 112 2334')
  await dialog.getByRole('button', { name: 'Send invite', exact: true }).click()
  await expect(page.getByText('Amal has been invited.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Team & access', exact: true }).click()
  await expect(page.getByText('Kasun Fernando', { exact: true })).toBeVisible()
})
