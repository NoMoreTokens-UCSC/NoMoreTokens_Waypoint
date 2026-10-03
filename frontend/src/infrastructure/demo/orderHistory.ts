import type { Order, Temperature } from '../../domain/models'

/**
 * Demo history for OUT001: its Fresh orders for the eight operating days before the demo's Friday,
 * 25 September 2026. Dry groceries every day, chilled on some days (the booklet's "several days a
 * week"), with the kinds of outcome a store sees: delivered and confirmed, an issue reported, and a
 * deferral. Kept apart from the live orders so the other roles' queues are not affected.
 */
const at = (date: string, time: string) => `${date}T${time}:00+05:30`

interface Day {
  /** The delivery day. */
  date: string
  /** The day the order was placed (Sunday is not an operating day). */
  placed: string
  dry: number
  chilled?: number
  /** A different outcome for one of the day's orders. */
  outcome?: { for: Temperature; kind: 'Missing' | 'Damaged' | 'Deferred'; affected?: number }
}
const days: Day[] = [
  { date: '2026-09-16', placed: '2026-09-15', dry: 25, chilled: 16 },
  {
    date: '2026-09-17',
    placed: '2026-09-16',
    dry: 22,
    outcome: { for: 'Ambient', kind: 'Damaged', affected: 1 },
  },
  { date: '2026-09-18', placed: '2026-09-17', dry: 24, chilled: 14 },
  {
    date: '2026-09-19',
    placed: '2026-09-18',
    dry: 28,
    chilled: 20,
    outcome: { for: 'Ambient', kind: 'Deferred' },
  },
  { date: '2026-09-21', placed: '2026-09-19', dry: 26 },
  {
    date: '2026-09-22',
    placed: '2026-09-21',
    dry: 20,
    chilled: 18,
    outcome: { for: 'Chilled', kind: 'Missing', affected: 2 },
  },
  { date: '2026-09-23', placed: '2026-09-22', dry: 24 },
  { date: '2026-09-24', placed: '2026-09-23', dry: 22, chilled: 16 },
]
const perCase: Record<Temperature, { kg: number; m3: number }> = {
  Chilled: { kg: 20 / 3, m3: 1 / 15 },
  Ambient: { kg: 10, m3: 0.1 },
}
const slot: Record<Temperature, { window: string; windowEnd: string; delivered: string }> = {
  Chilled: { window: '05:30', windowEnd: '07:30', delivered: '05:41' },
  Ambient: { window: '06:00', windowEnd: '08:00', delivered: '06:22' },
}

let counter = 900
function order(day: Day, temperature: Temperature, cases: number): Order {
  const id = `ORD0${(counter += 1)}`
  const per = perCase[temperature]
  const when = slot[temperature]
  const outcome = day.outcome?.for === temperature ? day.outcome : undefined
  const base: Order = {
    id,
    outlet: 'OUT001',
    outletName: 'Fresh Wattala',
    brand: 'Fresh',
    window: when.window,
    windowEnd: when.windowEnd,
    volume: Number((per.m3 * cases).toFixed(2)),
    weight: Math.round(per.kg * cases),
    temperature,
    cases,
    status: 'Delivered',
    priority: false,
    receipt: 'Confirmed',
    deliveryDate: day.date,
    placedAt: at(day.placed, '15:31'),
  }
  if (outcome?.kind === 'Deferred')
    return {
      ...base,
      status: 'Deferred',
      receipt: 'Pending',
      deferralReason: 'Insufficient Volume Capacity',
      deferredAt: at(day.placed, '16:12'),
      deferralAcknowledged: true,
      deferralAcknowledgedAt: at(day.date, '05:20'),
    }
  const delivered = {
    ...base,
    vehicleId: 'VEH055',
    trip: 1,
    scheduledAt: at(day.placed, '16:12'),
    departedAt: at(day.date, '05:18'),
    deliveredAt: at(day.date, when.delivered),
    receiptAt: at(
      day.date,
      when.delivered.replace(/:(\d\d)$/, (_, m) => `:${String(Number(m) + 4).padStart(2, '0')}`),
    ),
  }
  if (!outcome) return delivered
  const affected = outcome.affected ?? 1
  const description =
    outcome.kind === 'Missing'
      ? `${affected} cases were missing from the delivery.`
      : `${affected} case arrived crushed.`
  return {
    ...delivered,
    receipt: 'Issue reported',
    issue: `${outcome.kind} goods: ${description}`,
    receiptReport: {
      kind: outcome.kind as 'Missing' | 'Damaged',
      received: outcome.kind === 'Missing' ? cases - affected : cases,
      affected,
      description,
      recordedAt: delivered.receiptAt,
    },
  }
}

/** Oldest first. */
export const outletOrderHistory: Order[] = days.flatMap((day) => [
  order(day, 'Ambient', day.dry),
  ...(day.chilled ? [order(day, 'Chilled', day.chilled)] : []),
])
