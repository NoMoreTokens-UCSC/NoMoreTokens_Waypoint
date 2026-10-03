import type { Order, Stop } from './models'
import { formatClock } from './calendar'

export const FRESH_DEADLINE = '08:00'
export function clockMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim())
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return undefined
  return Number(match[1]) * 60 + Number(match[2])
}
export function deliveryWindow(stop: Stop, orders: Order[], now: Date) {
  const fresh = orders.some((order) => stop.orderIds.includes(order.id) && order.brand === 'Fresh')
  const end = stop.window.split(/[–—-]/).at(-1)?.trim() ?? ''
  const windowEnd = clockMinutes(end)
  const deadline = fresh ? Math.min(windowEnd ?? 480, 480) : windowEnd
  const eta = clockMinutes(stop.eta)
  const arrived =
    stop.status !== 'Upcoming' && !!stop.arrivedAt && Number.isFinite(Date.parse(stop.arrivedAt))
  const current = clockMinutes(formatClock(arrived ? new Date(stop.arrivedAt!) : now))!
  return {
    fresh,
    deadline:
      deadline === undefined
        ? 'Unspecified'
        : `${String(Math.floor(deadline / 60)).padStart(2, '0')}:${String(deadline % 60).padStart(2, '0')}`,
    arrived,
    etaLate: !arrived && deadline !== undefined && eta !== undefined && eta > deadline,
    overdue: deadline !== undefined && current > deadline,
    dueSoon: !arrived && deadline !== undefined && current <= deadline && deadline - current <= 30,
  }
}

/** Fresh receiving windows must allow completion by 08:00. */
export function freshWindowErrors(start: string, end?: string): string[] {
  const startMinutes = clockMinutes(start),
    endMinutes = end ? clockMinutes(end) : undefined
  if (startMinutes === undefined || startMinutes >= 480)
    return ['Fresh-food receiving must start before 08:00.']
  if (end && (endMinutes === undefined || endMinutes <= startMinutes || endMinutes > 480))
    return ['Fresh-food receiving must end after its start and by 08:00.']
  return []
}
export function receivingWindowEnd(start: string, end?: string, fresh = false): string {
  if (end) return end
  const minutes = Math.min((clockMinutes(start) ?? 360) + 120, fresh ? 480 : 1439)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
