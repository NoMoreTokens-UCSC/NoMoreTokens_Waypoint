import type { Order, Snapshot } from '../domain/models'

/** Demo states for the store's orders, so every store screen can be opened without the other roles. */
export type StoreDemoState =
  'confirmed' | 'scheduled' | 'en-route' | 'delivered' | 'received' | 'issue'

export const storeDemoStates: { value: StoreDemoState; label: string }[] = [
  { value: 'confirmed', label: 'Awaiting allocation' },
  { value: 'scheduled', label: 'Scheduled · one order deferred' },
  { value: 'en-route', label: 'En route · one order deferred' },
  { value: 'delivered', label: 'Delivered · receipt pending' },
  { value: 'received', label: 'Receipt confirmed · deferral acknowledged' },
  { value: 'issue', label: 'Issue reported · 2 cases missing' },
]

/** The story's timestamps: ordered Friday 25 September, delivered Saturday 26 September. */
const at = {
  scheduled: '2026-09-25T16:12:00+05:30',
  departed: '2026-09-26T05:18:00+05:30',
  delivered: '2026-09-26T05:41:00+05:30',
  receipt: '2026-09-26T05:44:00+05:30',
  acknowledged: '2026-09-26T05:18:00+05:30',
}
const clear: Partial<Order> = {
  status: 'Confirmed',
  vehicleId: undefined,
  trip: undefined,
  scheduledAt: undefined,
  departedAt: undefined,
  deliveredAt: undefined,
  deferredAt: undefined,
  deferralReason: undefined,
  deferralAcknowledged: undefined,
  deferralAcknowledgedAt: undefined,
  receipt: 'Pending',
  receiptAt: undefined,
  receiptReport: undefined,
  issue: undefined,
}
const order = (state: StoreDemoState): Partial<Order> => {
  const scheduled = { status: 'Scheduled', vehicleId: 'VEH055', trip: 1, scheduledAt: at.scheduled }
  const enRoute = { ...scheduled, status: 'En route', departedAt: at.departed } as const
  const delivered = { ...enRoute, status: 'Delivered', deliveredAt: at.delivered } as const
  switch (state) {
    case 'scheduled':
      return scheduled as Partial<Order>
    case 'en-route':
      return enRoute
    case 'delivered':
      return delivered
    case 'received':
      return { ...delivered, receipt: 'Confirmed', receiptAt: at.receipt }
    case 'issue':
      return {
        ...delivered,
        receipt: 'Issue reported',
        receiptAt: at.receipt,
        issue: 'Missing goods: Two cases are missing from the delivery.',
        receiptReport: {
          kind: 'Missing',
          received: 16,
          affected: 2,
          description: 'Two cases are missing from the delivery.',
          recordedAt: at.receipt,
        },
      }
    default:
      return {}
  }
}

/**
 * Puts the outlet's chilled order through `state` and defers its dry order from then on, as in the
 * design. Other outlets and the plan itself are left alone.
 */
export function applyStoreDemoState(
  snapshot: Snapshot,
  state: StoreDemoState,
  outletId = 'OUT001',
) {
  for (const o of snapshot.orders) {
    if (o.outlet !== outletId) continue
    Object.assign(o, clear)
    if (state === 'confirmed') continue
    if (o.temperature === 'Chilled') Object.assign(o, order(state))
    else
      Object.assign(o, {
        status: 'Deferred',
        deferralReason: 'Insufficient Volume Capacity',
        deferredAt: at.scheduled,
        ...(state === 'received'
          ? { deferralAcknowledged: true, deferralAcknowledgedAt: at.acknowledged }
          : {}),
      })
  }
  const delivered = ['delivered', 'received', 'issue'].includes(state)
  for (const stop of snapshot.stops)
    if (stop.outlet === outletId) stop.status = delivered ? 'Delivered' : 'Upcoming'
}
