import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Apis } from '../../domain/api'
import { OperationsService } from '../../application/OperationsService'
import { WaypointDatabase } from '../persistence/database'
import { DexieOperationsRepository } from '../persistence/DexieOperationsRepository'
import { createLocalApis } from './localApis'

let db: WaypointDatabase, apis: Apis
beforeEach(async () => {
  db = new WaypointDatabase(`waypoint-apis-${crypto.randomUUID()}`)
  const repository = new DexieOperationsRepository(db)
  const service = new OperationsService(repository, {
    submit: async (_action, _evidence, outcome) => ({ status: outcome, message: outcome }),
  })
  apis = createLocalApis(service)
  await repository.getSnapshot()
})
afterEach(async () => {
  db.close()
  await db.delete()
})

describe('local API adapters', () => {
  it('scopes orders and stops to an outlet', async () => {
    const orders = await apis.orders.listOrders({ outletId: 'OUT001' })
    expect(orders.map((order) => order.id).sort()).toEqual(['ORD1042', 'ORD1043'])
    const stops = await apis.delivery.listStops({ outletId: 'OUT001' })
    expect(stops.every((stop) => stop.outlet === 'OUT001')).toBe(true)
  })
  it('places both store orders and reads them back', async () => {
    await apis.orders.placeOrders('OUT001', [
      { temperature: 'Chilled', cases: 20, weight: 130, volume: 1.3, window: '05:30' },
      { temperature: 'Ambient', cases: 25, weight: 250, volume: 2.5, window: '06:00' },
    ])
    const chilled = (await apis.orders.listOrders({ outletId: 'OUT001' })).find(
      (order) => order.temperature === 'Chilled',
    )
    expect(chilled).toMatchObject({ cases: 20, weight: 130, status: 'Confirmed' })
  })
  it('refuses outlets the local demo does not model', async () => {
    await expect(apis.orders.createOrder('OUT002', 'Chilled', 10, '05:30')).rejects.toThrow(
      /OUT001 only/,
    )
  })
  it('projects trips from allocations', async () => {
    await apis.planning.autoAllocate()
    const plan = await apis.planning.getPlan()
    expect(plan.trips.length).toBeGreaterThan(0)
    expect(plan.status.published).toBe(false)
  })
  it('surfaces validation from the workflow rules', async () => {
    await expect(
      apis.orders.reportReceiptIssue('ORD1042', {
        kind: 'Missing',
        received: 16,
        affected: 2,
        description: 'Two cases missing',
      }),
    ).rejects.toThrow(/accepted delivery proof/)
  })
})
