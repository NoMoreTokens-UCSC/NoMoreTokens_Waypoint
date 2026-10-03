import { describe, expect, it } from 'vitest'
import { createSeed } from '../infrastructure/demo/seed'
import { deliveryWindow, freshWindowErrors, receivingWindowEnd } from './deliveryWindow'
const snapshot = createSeed(),
  stop = snapshot.stops[0]
describe('receiving deadlines in Sri Lanka', () => {
  it('caps fresh goods at 08:00 and detects late ETA, approaching and missed windows', () => {
    const late = { ...stop, window: '07:00–10:00', eta: '08:15' }
    expect(
      deliveryWindow(late, snapshot.orders, new Date('2026-10-03T07:45:00+05:30')),
    ).toMatchObject({
      fresh: true,
      deadline: '08:00',
      etaLate: true,
      dueSoon: true,
      overdue: false,
    })
    expect(
      deliveryWindow(late, snapshot.orders, new Date('2026-10-03T08:01:00+05:30')).overdue,
    ).toBe(true)
    expect(
      deliveryWindow(stop, snapshot.orders, new Date('2026-10-03T07:20:00+05:30')).deadline,
    ).toBe('07:30')
  })
  it('checks actual arrival so a later signature does not falsely mark an on-time arrival late', () => {
    const arrived = { ...stop, status: 'Arrived' as const, arrivedAt: '2026-10-03T07:20:00+05:30' }
    expect(
      deliveryWindow(arrived, snapshot.orders, new Date('2026-10-03T09:00:00+05:30')),
    ).toMatchObject({ arrived: true, overdue: false, dueSoon: false, etaLate: false })
    expect(
      deliveryWindow(
        { ...arrived, arrivedAt: '2026-10-03T08:10:00+05:30' },
        snapshot.orders,
        new Date('2026-10-03T09:00:00+05:30'),
      ).overdue,
    ).toBe(true)
  })
  it('preserves non-fresh receiving windows and blocks invalid fresh planning windows', () => {
    const orders = snapshot.orders.map((order) => ({ ...order, brand: 'Tech' as const }))
    expect(
      deliveryWindow(
        { ...stop, window: '09:00–11:00' },
        orders,
        new Date('2026-10-03T09:00:00+05:30'),
      ).deadline,
    ).toBe('11:00')
    expect(freshWindowErrors('08:00')).not.toEqual([])
    expect(freshWindowErrors('07:00', '09:00')).not.toEqual([])
    expect(freshWindowErrors('07:00', '08:00')).toEqual([])
    expect(receivingWindowEnd('07:00', undefined, true)).toBe('08:00')
  })
})
