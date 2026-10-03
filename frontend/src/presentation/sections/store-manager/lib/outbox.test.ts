import { describe, expect, it } from 'vitest'
import type { Order } from '../../../../domain/models'
import { applyOutbox, type OutboxItem } from './outbox'

const order = (overrides: Partial<Order>): Order => ({
  id: 'ORD1',
  outlet: 'OUT001',
  outletName: 'Fresh Wattala',
  brand: 'Fresh',
  window: '06:00',
  volume: 1,
  weight: 10,
  temperature: 'Ambient',
  cases: 5,
  status: 'Confirmed',
  priority: false,
  receipt: 'Pending',
  ...overrides,
})
const item = (request: OutboxItem['request'], status: OutboxItem['status'] = 'waiting') =>
  ({
    id: 'x',
    outletId: 'OUT001',
    request,
    title: 't',
    createdAt: '2026-09-25T10:00:00Z',
    status,
  }) as OutboxItem

describe('applyOutbox', () => {
  it('shows a waiting receipt as confirmed and marks it unsent', () => {
    const [result] = applyOutbox(
      [order({ status: 'Delivered' })],
      [item({ kind: 'receipt', orderId: 'ORD1' })],
    )
    expect(result.receipt).toBe('Confirmed')
    expect(result.pendingSync).toBe(true)
  })

  it('adds an order that does not exist yet and updates one that does', () => {
    const input = {
      temperature: 'Chilled' as const,
      cases: 4,
      weight: 27,
      volume: 0.3,
      window: '05:30',
    }
    const result = applyOutbox(
      [order({})],
      [item({ kind: 'orders', inputs: [{ ...input, temperature: 'Ambient', cases: 9 }, input] })],
    )
    expect(result).toHaveLength(2)
    expect(result[0].cases).toBe(9)
    expect(result[1].id).toBe('PENDING-C')
    expect(result.every((entry) => entry.pendingSync)).toBe(true)
  })

  it('ignores changes that failed or were kept as drafts', () => {
    const orders = [order({ status: 'Delivered' })]
    expect(
      applyOutbox(orders, [item({ kind: 'receipt', orderId: 'ORD1' }, 'failed')])[0].receipt,
    ).toBe('Pending')
  })
})
