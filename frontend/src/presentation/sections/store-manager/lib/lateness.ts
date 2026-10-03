import { formatClock } from '../../../../domain/calendar'
import type { Order, Stop } from '../../../../domain/models'
import { windowEnd } from './orderView'
import { minutes } from './windows'

/**
 * A late delivery matters to a store: receiving staff may have moved on, and a Fresh outlet may miss
 * morning sales (booklet, "arrival after the window closes"). These helpers compare the vehicle's
 * expected arrival with the order's receiving window. A backend can supply the expected arrival and a
 * lateness probability; the screens only need the stop's `eta`.
 */
export interface Lateness {
  minutesLate: number
  expected: string
  windowEnd: string
}

/** A dispatched, undelivered order whose expected arrival is after its window closes. */
export function runningLate(order: Order, stop?: Stop): Lateness | undefined {
  if (!stop || !['Scheduled', 'En route'].includes(order.status)) return undefined
  const end = windowEnd(order)
  const minutesLate = minutes(stop.eta) - minutes(end)
  return minutesLate > 0 ? { minutesLate, expected: stop.eta, windowEnd: end } : undefined
}

/** Minutes after the window closed that a delivered order arrived, when it did. */
export function deliveredLate(order: Order): number | undefined {
  if (order.status !== 'Delivered' || !order.deliveredAt) return undefined
  const late = minutes(formatClock(order.deliveredAt)) - minutes(windowEnd(order))
  return late > 0 ? late : undefined
}

export function lateOrders(orders: Order[], stops: Stop[]) {
  return orders.flatMap((order) => {
    const late = runningLate(
      order,
      stops.find((stop) => stop.orderIds.includes(order.id)),
    )
    return late ? [{ order, late }] : []
  })
}

/** "25 minutes", "1 hour", "1 hour 5 minutes". */
export function durationText(total: number) {
  const hours = Math.floor(total / 60)
  const rest = total % 60
  const part = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`
  return [hours && part(hours, 'hour'), rest && part(rest, 'minute')].filter(Boolean).join(' ')
}
