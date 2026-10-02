/** Explicit responsive counterparts; each id points to an original Figma frame. */
import type { DesignCatalog } from './types'
import { viewportFor } from './responsiveLayout'
export type ResponsiveFrames = readonly [desktop: string, tablet: string, mobile: string]
export const loaderFrames: readonly ResponsiveFrames[] = [
  ['2079:22982', '311:20855', '311:20806'],
  ['2079:23127', '300:20925', '300:20510'],
  ['2079:23242', '300:21004', '300:20588'],
  ['2079:23472', '318:21106', '318:20950'],
  ['2079:23579', '309:20860', '309:20782'],
  ['2079:23686', '72:801', '95:9328'],
  ['2079:23897', '72:802', '95:9355'],
  ['2079:24001', '72:803', '95:9370'],
  ['2079:24209', '10:358', '95:9389'],
  ['2079:24314', '300:21162', '7:26'],
  ['2079:24443', '306:20736', '300:20830'],
  ['2079:24572', '300:21200', '10:357'],
  ['2079:24786', '300:21238', '300:20744'],
  ['2079:25000', '300:21276', '300:20787'],
  ['2079:25100', '300:21083', '300:20666'],
  ['2079:25215', '318:21185', '318:21028'],
  ['2079:23790', '72:804', '300:20882'],
]
export function responsiveFrame(
  id: string,
  viewport: 'desktop' | 'tablet' | 'mobile',
  families: readonly ResponsiveFrames[],
) {
  const family = families.find((family) => family.includes(id))
  return family?.[viewport === 'desktop' ? 0 : viewport === 'tablet' ? 1 : 2] ?? id
}
export const screenFamilies: readonly ResponsiveFrames[] = [
  ...loaderFrames,
  ['94:9194', '94:9310', '7:28'],
  ['352:21218', '352:21218', '353:21235'],
  ['352:21383', '352:21383', '353:21335'],
  ['367:21457', '367:21457', '367:21383'],
  ['74:1309', '104:16271', '101:13485'],
  ['76:8022', '76:8022', '101:15631'],
  ['76:12470', '76:12470', '101:16547'],
  ['76:10246', '76:10246', '101:16159'],
  ['76:14694', '76:14694', '101:17705'],
  ['137:17712', '104:15768', '101:9355'],
  ['74:1241', '74:1241', '101:9355'],
  ['76:3792', '76:3792', '101:9873'],
  ['76:3934', '76:3934', '101:10389'],
  ['76:4076', '76:4076', '101:10905'],
  ['76:4218', '76:4218', '101:11421'],
  ['76:4360', '76:4360', '101:11937'],
  ['76:4502', '76:4502', '101:12453'],
  ['76:4644', '76:4644', '101:12969'],
  ['338:21061', '338:21061', '343:21162'],
]
const stateName = (name: string) =>
  name
    .replace(/\b(desktop|tablet|mobile)(\s+web)?\s*[·:]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export function resolveProductFrame(
  catalog: DesignCatalog | undefined,
  id: string | undefined,
  width: number,
) {
  if (!catalog || !id) return undefined
  const viewport = viewportFor(width)
  if (viewport !== 'mobile' && ['41:992', '41:993', '41:994'].includes(id))
    return catalog.frames.find(
      (frame) => frame.id === (viewport === 'desktop' ? '94:9194' : '94:9310'),
    )
  const explicit = screenFamilies.find((family) => family.includes(id))
  if (explicit)
    return catalog.frames.find(
      (frame) => frame.id === explicit[viewport === 'desktop' ? 0 : viewport === 'tablet' ? 1 : 2],
    )
  const requested = catalog.frames.find((frame) => frame.id === id)
  if (!requested) return undefined
  const family = catalog.frames.filter(
    (frame) =>
      frame.section === requested.section && stateName(frame.name) === stateName(requested.name),
  )
  return family.find((frame) => frame.viewport === viewport) ?? requested
}
export const repairedTransitions = [
  {
    section: 'administration',
    reason: 'Source sidebar destinations point to unrelated team states',
    actions: ['Users', 'Roles & access', 'Assignments', 'Audit log'],
  },
  {
    section: 'driver',
    reason: 'Connect existing quantity and receiver screens into proof submission',
    actions: ['Complete Delivery', 'Use this photo', 'Continue to review'],
  },
  {
    section: 'dispatcher',
    reason: 'Undo assignment must update the order allocation',
    actions: ['Undo assignment'],
  },
] as const
