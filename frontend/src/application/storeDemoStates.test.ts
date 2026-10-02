import { describe, expect, it } from 'vitest'
import { createSeed } from '../infrastructure/demo/seed'
import { applyStoreDemoState } from './storeDemoStates'

const orders = (state: Parameters<typeof applyStoreDemoState>[1]) => {
  const snapshot = createSeed()
  applyStoreDemoState(snapshot, state)
  const find = (id: string) => snapshot.orders.find((order) => order.id === id)!
  return { snapshot, chilled: find('ORD1042'), dry: find('ORD1043') }
}

describe('store demo states', () => {
  it('schedules the chilled order and defers the dry one', () => {
    const { chilled, dry } = orders('scheduled')
    expect(chilled).toMatchObject({ status: 'Scheduled', vehicleId: 'VEH055' })
    expect(dry).toMatchObject({
      status: 'Deferred',
      deferralReason: 'Insufficient Volume Capacity',
    })
    expect(dry.deferralAcknowledged).toBeUndefined()
  })
  it('walks the chilled order through the journey', () => {
    expect(orders('en-route').chilled.status).toBe('En route')
    expect(orders('delivered').chilled).toMatchObject({ status: 'Delivered', receipt: 'Pending' })
    expect(orders('received').chilled.receipt).toBe('Confirmed')
    expect(orders('received').dry.deferralAcknowledged).toBe(true)
    expect(orders('issue').chilled.receiptReport).toMatchObject({ kind: 'Missing', affected: 2 })
  })
  it('holds the vehicle up after the window in the late state, and restores the time after', () => {
    const late = orders('late')
    expect(late.chilled.status).toBe('En route')
    expect(late.snapshot.stops.find((stop) => stop.outlet === 'OUT001')?.eta).toBe('08:25')
    applyStoreDemoState(late.snapshot, 'en-route')
    expect(late.snapshot.stops.find((stop) => stop.outlet === 'OUT001')?.eta).toBe('05:40')
  })
  it('can return to the starting state and leaves other outlets alone', () => {
    const snapshot = createSeed()
    const other = snapshot.orders.find((order) => order.outlet !== 'OUT001')!
    const before = JSON.stringify(other)
    applyStoreDemoState(snapshot, 'issue')
    applyStoreDemoState(snapshot, 'confirmed')
    const chilled = snapshot.orders.find((order) => order.id === 'ORD1042')!
    expect(chilled).toMatchObject({ status: 'Confirmed', receipt: 'Pending' })
    expect(chilled.vehicleId).toBeUndefined()
    expect(JSON.stringify(other)).toBe(before)
  })
})
