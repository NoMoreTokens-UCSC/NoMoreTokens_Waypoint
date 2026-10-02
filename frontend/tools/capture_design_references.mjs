import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const catalog = JSON.parse(await readFile('public/figma/catalog.json', 'utf8'))
const selected = process.argv.slice(2)
const frames = selected.length
  ? catalog.frames.filter((f) => selected.includes(f.id))
  : catalog.frames
await mkdir('.figma-local/browser-captures', { recursive: true })
const browser = await chromium.launch({ headless: true })
const previous = JSON.parse(await readFile('docs/figma/browser-render-audit.json', 'utf8').catch(() => '[]'))
const report = selected.length ? previous.filter(row => catalog.frames.some(frame => frame.id === row.id) && !selected.includes(row.id)) : []
try {
  const page = await browser.newPage()
  for (const frame of frames) {
    const errors = []
    const onError = (e) => errors.push(e.message)
    page.on('pageerror', onError)
    await page.setViewportSize({ width: Math.round(frame.width), height: Math.round(frame.height) })
    try {
      await page.goto(`http://127.0.0.1:4175/design/${frame.id}`)
      await page.locator(`[data-node="${frame.id}"]`).waitFor({timeout:10000})
    } catch {
      await page.reload()
      try { await page.locator(`[data-node="${frame.id}"]`).waitFor({timeout:10000}) }
      catch (error) {
        report.push({id:frame.id,name:frame.name,errors:[error.message],missing:[],brokenImages:[]})
        await writeFile('docs/figma/browser-render-audit.json', JSON.stringify(report,null,2))
        page.off('pageerror',onError)
        continue
      }
    }
    try {
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const missing = await page
      .locator('[data-missing-asset]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-missing-asset')))
    const brokenImages = await page
      .locator('img')
      .evaluateAll((nodes) => nodes.filter((n) => !n.naturalWidth).map((n) => n.src))
    const path = `.figma-local/browser-captures/${frame.id.replace(':', '-')}.png`
    await page.screenshot({ path })
    report.push({ id: frame.id, name: frame.name, path, missing, brokenImages, errors })
    await writeFile('docs/figma/browser-render-audit.json', JSON.stringify(report, null, 2))
    } catch (error) {
      report.push({id:frame.id,name:frame.name,errors:[error.message],missing:[],brokenImages:[]})
      await writeFile('docs/figma/browser-render-audit.json',JSON.stringify(report,null,2))
    }
    page.off('pageerror', onError)
  }
} finally {
  await browser.close()
}
await writeFile('docs/figma/browser-render-audit.json', JSON.stringify(report, null, 2))
console.log(
  `Captured ${report.length} screens; ${report.filter((r) => r.missing.length || r.brokenImages.length || r.errors.length).length} require asset/render fixes.`,
)
