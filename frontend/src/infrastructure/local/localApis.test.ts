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
  it('exposes durable Driver drafts and validates capture through the API', async () => {
    expect(await apis.delivery.listProofDrafts()).toEqual([])
    expect(await apis.delivery.getProofDraft('STOP001')).toBeUndefined()
    await expect(
      apis.delivery.saveProofDraft({
        stopId: 'STOP001',
        photo: new Blob(['photo'], { type: 'image/png' }),
        fileName: 'photo.png',
        stage: 'captured',
        quantity: 18,
        receiver: '',
        acknowledged: false,
        exception: '',
        revision: 3,
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow('Park')
    await apis.delivery.deleteProofDraft('STOP001')
    expect(await apis.delivery.listProofDrafts()).toEqual([])
    await expect(apis.delivery.reportDelay('STOP001', 'Road blocked')).rejects.toThrow('open stop')
  })
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
  it('cancels an order before the cutoff and refuses once it has passed', async () => {
    await apis.orders.cancelOrder('ORD1042')
    const left = await apis.orders.listOrders({ outletId: 'OUT001' })
    expect(left.map((order) => order.id)).toEqual(['ORD1043'])
    const kept = (await apis.orders.listHistory({ outletId: 'OUT001' })).find(
      (order) => order.id === 'ORD1042',
    )
    expect(kept?.cancelledAt).toBeTruthy()
    await apis.account.updateSettings({ cutoffClosed: true })
    await expect(apis.orders.cancelOrder('ORD1043')).rejects.toThrow(/locked/)
  })
  it('updates a person’s own contact details and refuses bad ones', async () => {
    const good = {
      name: 'Nimal P. Perera',
      mobile: '+94 75 602 1999',
      email: 'nimal.p@example.test',
    }
    await apis.team.updateContact('USR004', good)
    const member = (await apis.team.listMembers()).find((entry) => entry.id === 'USR004')
    expect(member).toMatchObject({ name: good.name, mobile: good.mobile, email: good.email })
    await expect(apis.team.updateContact('USR004', { ...good, email: 'nope' })).rejects.toThrow(
      /valid email/,
    )
    await expect(apis.team.updateContact('USR004', { ...good, name: ' ' })).rejects.toThrow(
      /full name/,
    )
  })
  it('keeps several Tech orders and changes only the one picked', async () => {
    const item = {
      temperature: 'Ambient' as const,
      cases: 2,
      weight: 90,
      volume: 1.1,
      window: '09:00',
    }
    await apis.orders.placeOrders('OUT019', [item])
    await apis.orders.placeOrders('OUT019', [{ ...item, cases: 3, weight: 135 }])
    const placed = await apis.orders.listOrders({ outletId: 'OUT019' })
    expect(placed).toHaveLength(3)
    expect(new Set(placed.map((order) => order.id)).size).toBe(3)
    const target = placed.find((order) => order.cases === 3)!
    await apis.orders.placeOrders('OUT019', [
      { ...item, cases: 5, weight: 225, orderId: target.id },
    ])
    const after = await apis.orders.listOrders({ outletId: 'OUT019' })
    expect(after).toHaveLength(3)
    expect(after.find((order) => order.id === target.id)?.cases).toBe(5)
    await expect(
      apis.orders.placeOrders('OUT019', [{ ...item, orderId: 'ORD0000' }]),
    ).rejects.toThrow(/no longer open/)
  })
  it('refuses outlets the local demo does not model', async () => {
    await expect(apis.orders.createOrder('OUT002', 'Chilled', 10, '05:30')).rejects.toThrow(
      /OUT016 and OUT019 only/,
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
