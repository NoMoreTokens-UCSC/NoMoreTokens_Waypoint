import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Apis } from '../../domain/api'
import { OperationsService } from '../../application/OperationsService'
import { WaypointDatabase } from '../persistence/database'
import { DexieOperationsRepository } from '../persistence/DexieOperationsRepository'
import { createLocalApis } from './localApis'

let db: WaypointDatabase, apis: Apis, repository: DexieOperationsRepository
beforeEach(async () => {
  db = new WaypointDatabase(`waypoint-apis-${crypto.randomUUID()}`)
  repository = new DexieOperationsRepository(db)
  const service = new OperationsService(repository, {
    submit: async (_action, _evidence, outcome) => ({ status: outcome, message: outcome }),
  })
  apis = createLocalApis(service)
  await repository.getSnapshot()
})

async function publishLoads() {
  await apis.planning.autoAllocate()
  await apis.account.updateSettings({ cutoffClosed: true })
  await apis.planning.reviewAllocation()
  await apis.planning.publish()
  return (await apis.loading.getLoad('LOAD055-1'))!
}
const loadingPhoto = () =>
  new File([new Uint8Array([137, 80, 78, 71])], 'loading.png', { type: 'image/png' })
async function reconcile(loadId: string) {
  const load = (await apis.loading.getLoad(loadId))!
  for (const item of load.items)
    await apis.loading.setLoaded(load.id, item.outlet, item.expected, load.revision)
  for (const check of ['refrigeration', 'condition', 'restraints'] as const)
    await apis.loading.setCheck(load.id, check, true, load.revision)
}

describe('Loader API readiness', () => {
  it('blocks loading before publication and returns missing records safely', async () => {
    await expect(apis.loading.setLoaded('LOAD055-1', 'OUT001', 1, 3)).rejects.toThrow(/Publish/)
    await expect(apis.loading.complete('LOAD055-1', 3)).rejects.toThrow(/Publish/)
    expect(await apis.loading.getWorkspace('missing')).toBeUndefined()
    expect(await apis.loading.getWorkspace('LOAD055-1', 'Kandy')).toBeUndefined()
  })
  it('publishes every allocated trip and scopes its manifest, capacity and stops', async () => {
    await publishLoads()
    const plan = await apis.planning.getPlan()
    const loads = await apis.loading.listLoads()
    expect(loads).toHaveLength(plan.trips.length)
    for (const load of loads) {
      const workspace = (await apis.loading.getWorkspace(load.id))!
      const orders = plan.orders.filter(
        (order) => order.vehicleId === load.vehicleId && order.trip === load.trip,
      )
      expect(workspace.weight).toBe(orders.reduce((sum, order) => sum + order.weight, 0))
      expect(workspace.volume).toBe(orders.reduce((sum, order) => sum + order.volume, 0))
      expect(workspace.vehicle.id).toBe(load.vehicleId)
      expect(workspace.stops.every((stop) => stop.loadId === load.id)).toBe(true)
      expect(load.items.reduce((sum, item) => sum + item.expected, 0)).toBe(
        orders.reduce((sum, order) => sum + order.cases, 0),
      )
      expect(workspace.load.items.map((item) => item.stop)).toEqual(
        workspace.load.items.map((item) => item.stop).sort((a, b) => b - a),
      )
    }
    const assignedRoute = await apis.delivery.getRoute()
    expect(assignedRoute.stops.every((stop) => stop.loadId === 'LOAD055-1')).toBe(true)
    await repository.update((snapshot) => {
      snapshot.loads[1].depot = 'Kandy'
    })
    expect((await apis.loading.listLoads({ depot: 'Kandy' })).map((load) => load.id)).toEqual([
      loads[1].id,
    ])
    expect(
      (await apis.loading.listLoads({ depot: 'Peliyagoda' })).some(
        (load) => load.id === loads[1].id,
      ),
    ).toBe(false)
    expect(await apis.loading.listLoads({ depot: 'Unknown' })).toEqual([])
  })
  it('rejects invalid counts and stale writes without changing the record', async () => {
    const load = await publishLoads()
    for (const quantity of [-1, 0.5, load.items[0].expected + 1])
      await expect(
        apis.loading.setLoaded(load.id, load.items[0].outlet, quantity, load.revision),
      ).rejects.toThrow(/valid case/)
    await expect(
      apis.loading.setCheck(load.id, 'condition', true, load.revision - 1),
    ).rejects.toThrow(/changed/)
    await expect(
      apis.loading.setLoaded(load.id, load.items[0].outlet, 1, load.revision - 1),
    ).rejects.toThrow(/changed/)
    expect((await apis.loading.getLoad(load.id))?.checks.condition).toBe(false)
  })
  for (const kind of ['Missing', 'Damaged'] as const) {
    it(`holds ${kind.toLowerCase()} goods until a revised manifest is acknowledged`, async () => {
      const load = await publishLoads()
      await reconcile(load.id)
      await apis.loading.attachPhoto(load.id, loadingPhoto(), load.revision)
      const evidenceId = (await apis.loading.getLoad(load.id))!.photoId!
      await apis.loading.reportIssue(
        load.id,
        {
          kind,
          outlet: load.items[0].outlet,
          affectedCases: 1,
          description: 'One grocery case affected',
        },
        load.revision,
      )
      expect((await apis.loading.getLoad(load.id))?.photoId).toBeUndefined()
      await expect(apis.loading.complete(load.id, load.revision)).rejects.toThrow(/shortfall/)
      await expect(
        apis.loading.attachPhoto(load.id, loadingPhoto(), load.revision),
      ).rejects.toThrow(/case counts/)
      await apis.loading.resolveIssue(load.id)
      const revised = (await apis.loading.getLoad(load.id))!
      expect(revised.revision).toBe(load.revision + 1)
      expect(revised.items.every((item) => item.loaded === 0)).toBe(true)
      expect(Object.values(revised.checks).every((value) => !value)).toBe(true)
      expect(revised.issueDetails?.kind).toBe(kind)
      await expect(
        apis.loading.setCheck(load.id, 'condition', true, revised.revision),
      ).rejects.toThrow(/acknowledge/)
      await expect(apis.loading.acknowledgeRevision(load.id, load.revision)).rejects.toThrow(
        /changed/,
      )
      await apis.loading.acknowledgeRevision(load.id, revised.revision)
      await reconcile(load.id)
      await apis.loading.attachPhoto(load.id, loadingPhoto(), revised.revision)
      await apis.loading.complete(load.id, revised.revision)
      expect(
        (await new DexieOperationsRepository(db).getSnapshot()).loads.find(
          (entry) => entry.id === load.id,
        )?.completed,
      ).toBe(true)
      expect((await apis.delivery.getEvidence(evidenceId))?.revision).toBe(load.revision)
    })
  }
  it('validates structured reports without lowering expected demand', async () => {
    const load = await publishLoads()
    await expect(
      apis.loading.reportIssue(
        load.id,
        { kind: 'Missing', outlet: 'unknown', affectedCases: 1, description: 'Milk case missing' },
        load.revision,
      ),
    ).rejects.toThrow(/valid affected/)
    await expect(
      apis.loading.reportIssue(
        load.id,
        {
          kind: 'Damaged',
          outlet: load.items[0].outlet,
          affectedCases: 0,
          description: 'Milk case damaged',
        },
        load.revision,
      ),
    ).rejects.toThrow(/valid affected/)
    expect((await apis.loading.getLoad(load.id))?.items).toEqual(load.items)
  })
  it('enforces photo validation and locks every write after departure', async () => {
    const load = await publishLoads()
    await reconcile(load.id)
    await expect(
      apis.loading.attachPhoto(
        load.id,
        new File([], 'empty.png', { type: 'image/png' }),
        load.revision,
      ),
    ).rejects.toThrow(/10 MB/)
    await expect(
      apis.loading.attachPhoto(
        load.id,
        new File(['text'], 'text.txt', { type: 'text/plain' }),
        load.revision,
      ),
    ).rejects.toThrow(/JPEG/)
    await expect(
      apis.loading.attachPhoto(
        load.id,
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
        load.revision,
      ),
    ).rejects.toThrow(/10 MB/)
    await apis.loading.attachPhoto(load.id, loadingPhoto(), load.revision)
    await apis.loading.complete(load.id, load.revision)
    await apis.planning.release(load.id)
    await expect(apis.loading.complete(load.id, load.revision)).rejects.toThrow(/departed/)
    await expect(
      apis.loading.setLoaded(load.id, load.items[0].outlet, 0, load.revision),
    ).rejects.toThrow(/departed/)
    await expect(apis.loading.setCheck(load.id, 'condition', false, load.revision)).rejects.toThrow(
      /departed/,
    )
    await expect(apis.loading.attachPhoto(load.id, loadingPhoto(), load.revision)).rejects.toThrow(
      /departed/,
    )
    await expect(
      apis.loading.reportIssue(load.id, 'One case damaged', load.revision),
    ).rejects.toThrow(/departed/)
  })
  it("does not accept missing or another load revision's proof", async () => {
    const load = await publishLoads()
    await reconcile(load.id)
    await repository.update((snapshot) => {
      snapshot.loads.find((entry) => entry.id === load.id)!.photoId = 'missing-photo'
    })
    await expect(apis.loading.complete(load.id, load.revision)).rejects.toThrow(
      /missing or outdated/,
    )
    await apis.loading.attachPhoto(load.id, loadingPhoto(), load.revision)
    const photoId = (await apis.loading.getLoad(load.id))!.photoId!
    await db.evidence.update(photoId, { revision: load.revision - 1 })
    await expect(apis.loading.complete(load.id, load.revision)).rejects.toThrow(
      /missing or outdated/,
    )
  })
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
  it('summarises the team including people the list does not page in', async () => {
    const summary = await apis.team.getSummary()
    expect(summary).toMatchObject({ total: 48, active: 41, invited: 5, suspended: 2 })
    expect(summary.auditEvents).toBeGreaterThan(200)
  })
  it('lists a person’s recent activity, newest first', async () => {
    const driver = await apis.team.listActivity('USR001')
    expect(driver[0]).toMatchObject({ when: '05:41', title: 'Submitted delivery proof' })
    expect(driver).toHaveLength(5)
    expect(await apis.team.listActivity('USR999')).toEqual([])
  })
  it('creates an account with a username and keeps no password', async () => {
    const user = {
      name: 'Dilani Rajapaksa',
      mobile: '+94 77 555 0101',
      role: 'loader' as const,
      depot: 'Peliyagoda',
      assignment: 'Dock bay 04',
      username: 'dilani.rajapaksa',
      password: 'Kp7mQx2RtWn4',
    }
    await apis.team.createUser(user)
    const created = (await apis.team.listMembers()).find(
      (member) => member.username === user.username,
    )
    expect(created).toMatchObject({ status: 'Invited', role: 'loader', assignment: 'Dock bay 04' })
    // Nothing the demo keeps (people, audit, the whole workspace) contains the password.
    const snapshot = await repository.getSnapshot()
    expect(JSON.stringify(snapshot)).not.toContain(user.password)
    expect((await apis.team.listAudit())[0]).toMatchObject({ action: 'Account created' })
    await expect(apis.team.createUser({ ...user, mobile: '+94 77 555 0102' })).rejects.toThrow(
      /username is already taken/,
    )
    await expect(
      apis.team.createUser({ ...user, username: 'second.user', password: 'short' }),
    ).rejects.toThrow(/at least 8 characters/)
    await expect(
      apis.team.createUser({ ...user, username: 'Bad Name!', mobile: '+94 77 555 0103' }),
    ).rejects.toThrow(/Usernames are/)
  })
  it('resets access with a valid temporary password and records it without the password', async () => {
    await apis.team.resetAccess('USR004', 'Wq4nLm8Zxk2P')
    const snapshot = await repository.getSnapshot()
    expect(JSON.stringify(snapshot)).not.toContain('Wq4nLm8Zxk2P')
    expect((await apis.team.listAudit())[0]).toMatchObject({ action: 'Access reset' })
    await expect(apis.team.resetAccess('USR004', 'nodigits')).rejects.toThrow(
      /at least 8 characters/,
    )
  })
  it('suspends an on-route driver only after a schedule or with a reason', async () => {
    await repository.update((snapshot) => {
      snapshot.members.find((member) => member.id === 'USR001')!.onRoute = true
    })
    const driver = async () =>
      (await apis.team.listMembers()).find((member) => member.id === 'USR001')!
    await expect(apis.team.suspend('USR001')).rejects.toThrow(/on route/)
    await expect(apis.team.suspend('USR001', false, 'no')).rejects.toThrow(/on route/)
    await apis.team.suspend('USR001', true)
    expect(await driver()).toMatchObject({ suspensionScheduled: true, status: 'Active' })
    await apis.team.suspend('USR001', false, 'Vehicle broke down on the Kandy road')
    expect(await driver()).toMatchObject({ status: 'Suspended', onRoute: false })
    const audit = await apis.team.listAudit()
    expect(audit.some((entry) => entry.action === 'Suspended mid-route')).toBe(true)
  })
  it('refuses outlets the local demo does not model', async () => {
    await expect(apis.orders.createOrder('OUT002', 'Chilled', 10, '05:30')).rejects.toThrow(
      /OUT016 and OUT019 only/,
    )
  })
  it('applies the 08:00 deadline to Fresh without blocking the Style mall window', async () => {
    const input = {
      temperature: 'Ambient' as const,
      cases: 20,
      weight: 200,
      volume: 2,
      window: '08:00',
      windowEnd: '09:00',
    }
    await apis.orders.placeOrders('OUT016', [input])
    expect(await apis.orders.listOrders({ outletId: 'OUT016' })).toEqual([
      expect.objectContaining({ window: '08:00', windowEnd: '09:00', brand: 'Style' }),
    ])
    await expect(apis.orders.placeOrders('OUT001', [input])).rejects.toThrow(/before 08:00/)
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
