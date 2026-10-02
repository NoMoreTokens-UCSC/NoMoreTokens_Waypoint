import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'

const catalog = JSON.parse(await fs.readFile('public/figma/catalog.json', 'utf8'))
const requestedWidth = Number(process.env.RESPONSIVE_AUDIT_WIDTH) || undefined
const selected = process.env.RESPONSIVE_AUDIT_IDS?.split(',')
const suffix = requestedWidth ? `-${requestedWidth}` : ''
const directory = `.figma-local/responsive-audit${suffix}`
await fs.mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ serviceWorkers: 'block', reducedMotion: 'reduce' })
const output = `docs/figma/responsive-audit${suffix}.json`
const results = selected
  ? JSON.parse(await fs.readFile(output, 'utf8')).filter((item) => !selected.includes(item.id))
  : []
const base = process.env.RESPONSIVE_AUDIT_URL ?? 'http://127.0.0.1:4175'
for (const [index, frame] of catalog.frames.entries()) {
  if (frame.id === '438:154') continue
  if (selected && !selected.includes(frame.id)) continue
  const errors = []
  const error = (value) => errors.push(value.message)
  page.on('pageerror', error)
  const width = requestedWidth ?? frame.width,
    height = Math.min(frame.height, 1024)
  await page.setViewportSize({ width, height })
  try {
    const overlay = /dialog|drawer|navigation \/|dropdown/i.test(frame.name)
    await page.goto(
      `${base}/demo/responsive/${encodeURIComponent(frame.id)}${overlay ? '?overlay=1' : ''}`,
    )
    await page.locator('[data-render-mode="product"]').waitFor()
    await page.evaluate(() => document.fonts.ready)
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[data-render-mode="product"]')
      const overflow = []
      const overlaps = []
      const clipped = []
      for (const parent of [root, ...root.querySelectorAll('[data-layer]')]) {
        const siblings = [...parent.children].filter(
          (node) =>
            node.hasAttribute('data-layer') &&
            !['absolute', 'fixed'].includes(getComputedStyle(node).position),
        )
        const parentStyle = getComputedStyle(parent),
          bounds = parent.getBoundingClientRect()
        for (const child of siblings) {
          if (!child.textContent?.trim()) continue
          const box = child.getBoundingClientRect()
          if (
            (bounds.height < 1 && box.height > 1 && box.width > 1) ||
            (parentStyle.overflowX === 'hidden' &&
              (box.left < bounds.left - 1 || box.right > bounds.right + 1)) ||
            (parentStyle.overflowY === 'hidden' &&
              (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1))
          )
            clipped.push([parent.getAttribute('data-node'), child.getAttribute('data-node')])
        }
        for (let i = 0; i < siblings.length; i++)
          for (let j = i + 1; j < siblings.length; j++) {
            const a = siblings[i].getBoundingClientRect(),
              b = siblings[j].getBoundingClientRect()
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            )
              overlaps.push([
                siblings[i].getAttribute('data-node'),
                siblings[j].getAttribute('data-node'),
              ])
          }
      }
      for (const node of root.querySelectorAll('[data-layer]')) {
        if (node.children.length || !node.textContent?.trim()) continue
        const box = node.getBoundingClientRect(),
          style = getComputedStyle(node)
        if (!box.width || !box.height || style.textOverflow === 'ellipsis') continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const text = range.getBoundingClientRect()
        const leading = Math.max(5, parseFloat(style.fontSize) * 0.3)
        const parent = node.parentElement.getBoundingClientRect()
        const labelFits =
          node.getAttribute('data-layer') === 'Label' &&
          text.left >= parent.left - 1 &&
          text.right <= parent.right + 1
        if ((!labelFits && text.width > box.width + 5) || text.height > box.height + leading)
          overflow.push({
            id: node.getAttribute('data-node'),
            name: node.getAttribute('data-layer'),
            text: node.textContent.slice(0, 70),
            box: [box.width, box.height],
            textSize: [text.width, text.height],
          })
      }
      return {
        pageWidth: document.documentElement.scrollWidth,
        rootWidth: root.getBoundingClientRect().width,
        resolvedFrame: root.getAttribute('data-node'),
        overflow,
        overlaps,
        clipped,
        missingAssets: [...root.querySelectorAll('[data-missing-asset]')].map((node) =>
          node.getAttribute('data-missing-asset'),
        ),
      }
    })
    const item = { id: frame.id, name: frame.name, width, height, overlay, ...metrics, errors }
    results.push(item)
    if (
      metrics.overflow.length ||
      metrics.overlaps.length ||
      metrics.clipped.length ||
      metrics.pageWidth > width + 1 ||
      errors.length
    )
      await page.screenshot({
        path: `${directory}/${frame.id.replace(':', '-')}.png`,
        fullPage: true,
      })
  } catch (error) {
    results.push({ id: frame.id, errors: [String(error)] })
  }
  page.off('pageerror', error)
  await fs.writeFile(output, JSON.stringify(results, null, 2))
  if (index % 25 === 0) console.log(`Audited ${index + 1} / ${catalog.frames.length}`)
}
await browser.close()
console.log(
  JSON.stringify({
    frames: results.length,
    pageOverflow: results.filter((item) => item.pageWidth > item.width + 1).length,
    textOverflow: results.filter((item) => item.overflow?.length).length,
    overlaps: results.filter((item) => item.overlaps?.length).length,
    clipped: results.filter((item) => item.clipped?.length).length,
    errors: results.filter((item) => item.errors.length).length,
  }),
)
