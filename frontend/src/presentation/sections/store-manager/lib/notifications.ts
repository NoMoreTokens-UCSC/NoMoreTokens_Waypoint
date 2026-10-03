import type { Order } from '../../../../domain/models'
import { receiptLabel } from './orderList'
import { issueReference, kindSlash } from './orderView'

export type FeedKind = 'order' | 'delivery' | 'deferral' | 'receipt' | 'issue'
export interface FeedEvent {
  id: string
  at: string
  orderId: string
  kind: FeedKind
  title: string
  detail: string
  /** True while the store still has to do something about it. */
  needsAction?: boolean
}

export const feedFilters: { value: FeedKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deferral', label: 'Deferrals' },
  { value: 'delivery', label: 'Deliveries' },
  { value: 'issue', label: 'Issues' },
]

/**
 * What happened to this outlet's orders, newest first, built from the times each order records.
 * A backend can serve the same events from a notifications endpoint; the screen only needs this shape.
 */
export function buildFeed(orders: Order[]): FeedEvent[] {
  const events: FeedEvent[] = []
  for (const order of orders) {
    const what = `${order.id} · ${kindSlash(order)}`
    const add = (
      kind: FeedKind,
      suffix: string,
      at: string | undefined,
      title: string,
      detail: string,
      needsAction?: boolean,
    ) =>
      at &&
      events.push({
        id: `${order.id}-${suffix}`,
        at,
        orderId: order.id,
        kind,
        title,
        detail,
        needsAction,
      })
    add('order', 'placed', order.placedAt, 'Order placed', `${what} · ${order.cases} cases`)
    add(
      'order',
      'cancelled',
      order.cancelledAt,
      'Order cancelled',
      `${what} · withdrawn before the cutoff`,
    )
    add(
      'order',
      'scheduled',
      order.scheduledAt,
      'Order scheduled',
      `${what} · vehicle ${order.vehicleId ?? 'assigned'}`,
    )
    add('delivery', 'departed', order.departedAt, 'Delivery on its way', `${what} left the depot`)
    add(
      'delivery',
      'delivered',
      order.deliveredAt,
      'Delivered',
      what,
      order.status === 'Delivered' && order.receipt === 'Pending',
    )
    add(
      'deferral',
      'deferred',
      order.deferredAt,
      'Delivery deferred',
      `${what} · ${order.deferralReason ?? 'Moved to the next run'}`,
      order.status === 'Deferred' && !order.deferralAcknowledged,
    )
    add('deferral', 'acknowledged', order.deferralAcknowledgedAt, 'Deferral acknowledged', what)
    if (order.receipt === 'Confirmed')
      add('receipt', 'receipt', order.receiptAt, 'Receipt confirmed', what)
    if (order.receiptReport)
      add(
        'issue',
        'issue',
        order.receiptReport.recordedAt,
        `${order.receiptReport.kind} items reported`,
        `${what} · ${issueReference(order, order.receiptReport.kind)} · ${receiptLabel(order)?.text ?? ''}`,
      )
  }
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

/** Orders where the store still has something to do, most urgent kinds first. */
export function actionsNeeded(orders: Order[]) {
  return {
    deferrals: orders.filter((order) => order.status === 'Deferred' && !order.deferralAcknowledged),
    receipts: orders.filter((order) => order.status === 'Delivered' && order.receipt === 'Pending'),
  }
}

/** Reported issues, newest first, with where each stands. Nothing here resolves them yet. */
export const reportedIssues = (orders: Order[]) =>
  orders
    .filter((order) => order.receiptReport)
    .sort((a, b) => b.receiptReport!.recordedAt.localeCompare(a.receiptReport!.recordedAt))
