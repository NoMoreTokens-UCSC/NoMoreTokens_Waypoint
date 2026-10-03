import { test, expect } from '@playwright/test'

test.describe('welcome page motion', () => {
  test('the hero counts up, the quick bar appears after the hero and the cue scrolls on', async ({
    page,
  }) => {
    // The suite runs with reduced motion; these tests need the motion on.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/welcome')
    const stats = page.locator('.entry-stats')
    // The numbers count up to their final values (screen readers always get the final value).
    await expect(stats.locator('[aria-hidden="true"]').first()).toHaveText('60')
    await expect(stats.locator('[aria-hidden="true"]').nth(1)).toHaveText('120')
    await expect(page.locator('.entry-sticky')).toHaveCount(0)
    await page.getByRole('button', { name: 'Scroll to the next section' }).click()
    await expect(page.locator('.entry-sticky')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Quick links' })).toContainText(
      'Enter your workspace',
    )
    // The brand counts and the steps appear as they are reached.
    await expect(page.locator('.entry-brand').first()).toContainText('supermarkets')
    await page.locator('.entry-steps').scrollIntoViewIfNeeded()
    await expect(page.locator('.entry-steps')).toHaveAttribute('data-visible', 'true')
    // Back at the top the quick bar goes away again.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('.entry-sticky')).toHaveCount(0)
  })

  test('the morning-run preview moves through its stages', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/welcome')
    const status = page.locator('.entry-run-status').first()
    const first = await status.textContent()
    await expect.poll(async () => status.textContent(), { timeout: 8000 }).not.toBe(first)
  })

  test('nothing animates for people who ask for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/welcome')
    await expect(page.locator('.entry-stats [aria-hidden="true"]').first()).toHaveText('60')
    const animation = await page
      .locator('.entry-live')
      .evaluate((node) => getComputedStyle(node).animationName)
    expect(animation).toBe('none')
    // The run preview stays on its first stage instead of cycling.
    const status = page.locator('.entry-run-status').first()
    const first = await status.textContent()
    await page.waitForTimeout(3200)
    expect(await status.textContent()).toBe(first)
  })

  test('the page does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/welcome')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
