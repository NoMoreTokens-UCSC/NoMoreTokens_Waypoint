import type { Page } from '@playwright/test'

/** Keep browser checks independent of public tile availability and external coordinate requests. */
export async function mockMapTiles(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
}
