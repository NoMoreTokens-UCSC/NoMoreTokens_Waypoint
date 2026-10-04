import { formatLongDate } from '../../../../domain/calendar'
import type { Order } from '../../../../domain/models'
import { storeStatus } from './orderView'
import type { BusinessClock } from '../../../session/useBusinessClock'

/** The day an order is for: its own delivery day, or the next run for a live order. */
export function deliveryDay(order: Order, clock: BusinessClock) {
  return order.deliveryDate ? new Date(`${order.deliveryDate}T12:00:00+05:30`) : clock.deliveryDate
}
export const deliveryDayLabel = (order: Order, clock: BusinessClock) =>
  formatLongDate(deliveryDay(order, clock))

/** True while the order is still moving or waiting for the store. */
export const isOpen = (order: Order) =>
  !order.cancelledAt &&
  order.status !== 'Deferred' &&
  !(order.status === 'Delivered' && order.receipt !== 'Pending')
/** True when something is waiting for the store or went wrong. */
export const needsAttention = (order: Order) =>
  !order.cancelledAt &&
  ((order.status === 'Deferred' && !order.deferralAcknowledged) ||
    (order.status === 'Delivered' && order.receipt === 'Pending') ||
    order.receipt === 'Issue reported')

export type OrderFilter = 'all' | 'open' | 'attention' | 'done' | 'cancelled'
export const filters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
export function matchesFilter(order: Order, filter: OrderFilter) {
  switch (filter) {
    case 'open':
      return isOpen(order)
    case 'attention':
      return needsAttention(order)
    case 'done':
      return !order.cancelledAt && order.status === 'Delivered' && order.receipt === 'Confirmed'
    case 'cancelled':
      return Boolean(order.cancelledAt)
    default:
      return true
  }
}

/** The receipt pill shown beside a delivered order. */
export function receiptLabel(order: Order & { pendingSync?: boolean }) {
  if (order.status !== 'Delivered') return undefined
  if (order.pendingSync && order.receipt !== 'Pending')
    return { text: 'Waiting to send', tone: 'orange' as const }
  return order.receipt === 'Confirmed'
    ? { text: 'Receipt confirmed', tone: 'green' as const }
    : order.receipt === 'Issue reported'
      ? { text: 'Issue reported', tone: 'amber' as const }
      : { text: 'Receipt pending', tone: 'amber' as const }
}

/** Orders shown on one page of the list. */
export const pageSize = 8

/** Matches an order number, temperature, delivery day or status, ignoring case. */
export function matchesQuery(order: Order, query: string, clock: BusinessClock) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [
    order.id,
    order.reference ?? '',
    order.temperature === 'Chilled' ? 'chilled' : 'dry ambient',
    deliveryDayLabel(order, clock),
    storeStatus(order),
    receiptLabel(order)?.text ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return words.every((word) => text.includes(word))
}

/** The most recent earlier day's orders (not cancelled), for "repeat last order". */
export function lastOrders(history: Order[]) {
  const dated = history.filter((order) => order.deliveryDate && !order.cancelledAt)
  const latest = dated
    .map((order) => order.deliveryDate!)
    .sort()
    .at(-1)
  return dated.filter((order) => order.deliveryDate === latest)
}
