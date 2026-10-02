import type { Order } from '../../../../domain/models'

const base = (order: Order) => `/store-manager/deliveries/${order.id}`

/**
 * Where a delivered order's receipt screen should be: the question while it is open, its result
 * once the store has answered, and the deliveries list for an issue with no structured report.
 */
export function receiptDestination(order: Order) {
  if (order.receipt === 'Pending') return `${base(order)}/receipt`
  if (order.receipt === 'Confirmed') return `${base(order)}/receipt/confirmed`
  return order.receiptReport ? `${base(order)}/issue/submitted` : '/store-manager/deliveries'
}
