import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'
const directory = 'docs/figma/responsive-captures'
await fs.mkdir(directory, { recursive: true })
const before = {
  'fleet-long': 'f63ae279-ea27-42ed-915c-58b155e64ff1',
  workspaces: 'c48c421a-07ac-445e-8faf-899f8de86e7e',
  'welcome-footer': '8a7560c6-34d0-4ae4-b290-12694d2912cd',
  tracking: 'f9f727d7-e461-41d8-ac2b-2d3edf56698f',
  fleet: '4e19273a-15de-4822-8a3b-dba8e5a57090',
  'driver-menu': '90609ef5-0a68-46a4-bd1f-e88897d763d8',
}
for (const [name, id] of Object.entries(before))
  await fs.copyFile(
    `C:/Users/abdul/AppData/Local/Temp/codex-clipboard-${id}.png`,
    `${directory}/${name}-before.png`,
  )
const browser = await chromium.launch()
const page = await browser.newPage({ serviceWorkers: 'block', reducedMotion: 'reduce' })
const captures = [
  ['/workspaces', 'workspaces', 1440, 1280],
  ['/dispatcher/fleet', 'fleet', 1440, 838],
  ['/dispatcher/fleet', 'fleet-tablet', 834, 1112],
  ['/dispatcher/tracking', 'tracking', 1440, 1264],
  ['/welcome', 'welcome-footer', 1024, 1275],
  ['/driver/route?frame=7%3A28&stop=STOP001', 'driver-desktop', 1440, 900],
  ['/welcome', 'home-desktop', 1440, 900],
  ['/welcome', 'home-tablet', 834, 1112],
  ['/welcome', 'home-mobile', 390, 844],
]
for (const [route, name, width, height] of captures) {
  await page.setViewportSize({ width, height })
  await page.goto('http://127.0.0.1:4173' + route)
  await page.locator('[data-render-mode="product"]').first().waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
  })
  if (name === 'welcome-footer')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.screenshot({
    path: `${directory}/${name}-after.png`,
    fullPage: name.startsWith('home-'),
  })
}
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://127.0.0.1:4173/driver/route?frame=7%3A28&stop=STOP001')
await page.getByRole('button', { name: 'MenuButton', exact: true }).click()
await page.setViewportSize({ width: 1440, height: 1238 })
await page.getByRole('dialog').waitFor()
await page.screenshot({ path: `${directory}/driver-menu-after.png` })
await browser.close()
console.log('Six supplied before images and seven corrected captures saved.')
