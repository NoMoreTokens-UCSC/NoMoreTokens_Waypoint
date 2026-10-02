import type { Order, Temperature } from '../../../../domain/models'

/** Labels for the two separate Fresh order records an outlet places. */
export const orderKinds: Record<
  Temperature,
  { title: string; subtitle: string; short: string; rule: string }
> = {
  Chilled: {
    title: 'Fresh · Chilled',
    subtitle: 'Chilled groceries',
    short: 'Chilled',
    rule: 'Requires a temperature-controlled vehicle.',
  },
  Ambient: {
    title: 'Fresh · Dry',
    subtitle: 'Dry groceries · Ambient',
    short: 'Dry',
    rule: 'Separate from your chilled grocery order.',
  },
}
export const temperatures: Temperature[] = ['Chilled', 'Ambient']
/** The two-line "Fresh / Chilled" label used in tracking and receipt headings. */
export const kindSlash = (temperature: Temperature) =>
  temperature === 'Chilled' ? 'Fresh / Chilled' : 'Fresh / Dry'

/** Receiving windows default to two hours when the order doesn't record an end. */
const DEFAULT_WINDOW_MINUTES = 120
export function addMinutes(clock: string, minutes: number) {
  const [h, m] = clock.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
export const windowEnd = (order: Pick<Order, 'window' | 'windowEnd'>) =>
  order.windowEnd ?? addMinutes(order.window, DEFAULT_WINDOW_MINUTES)
/** "05:30–07:30" */
export const windowText = (order: Pick<Order, 'window' | 'windowEnd'>) =>
  `${order.window}–${windowEnd(order)}`

const number = (value: number) => Number(value.toFixed(2))
export function totals(items: { cases: number; weight: number; volume: number }[]) {
  return {
    orders: items.length,
    cases: items.reduce((sum, item) => sum + item.cases, 0),
    weight: number(items.reduce((sum, item) => sum + item.weight, 0)),
    volume: number(items.reduce((sum, item) => sum + item.volume, 0)),
  }
}
/** "18 cases · 120 kg · 1.2 m³" */
export const quantityText = (item: { cases: number; weight: number; volume: number }) =>
  `${item.cases} cases · ${number(item.weight)} kg · ${number(item.volume)} m³`

/** What the store sees: allocation stays private until the dispatcher publishes the plan. */
export function storeStatus(order: Order) {
  switch (order.status) {
    case 'Deferred':
      return 'Deferred'
    case 'Delivered':
      return 'Delivered'
    case 'En route':
      return 'En route'
    case 'Scheduled':
      return 'Scheduled'
    default:
      return 'Awaiting allocation'
  }
}
/** A short issue reference, e.g. ORD1042 + Missing → "ISS-1042-M". */
export const issueReference = (order: Order, kind: 'Missing' | 'Damaged') =>
  `ISS-${order.id.replace(/^ORD/, '')}-${kind[0]}`
