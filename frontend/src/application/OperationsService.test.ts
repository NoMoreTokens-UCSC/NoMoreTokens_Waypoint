import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WaypointDatabase } from '../infrastructure/persistence/database'
import { DexieOperationsRepository } from '../infrastructure/persistence/DexieOperationsRepository'
import { OperationsService } from './OperationsService'
import type { SyncGateway } from '../domain/ports'

let db: WaypointDatabase, repo: DexieOperationsRepository, service: OperationsService
const photo = () =>
  new File([new Uint8Array([137, 80, 78, 71])], 'proof.png', { type: 'image/png' })
const gateway: SyncGateway = {
  submit: async (_action, _evidence, outcome) => ({ status: outcome, message: `Demo ${outcome}` }),
}
beforeEach(async () => {
  db = new WaypointDatabase(`waypoint-test-${crypto.randomUUID()}`)
  repo = new DexieOperationsRepository(db)
  service = new OperationsService(repo, gateway)
  await repo.getSnapshot()
})
afterEach(async () => {
  db.close()
  await db.delete()
})
async function prepareTrip() {
  await service.autoAllocate()
  await service.updateSettings({ cutoffClosed: true })
  await service.reviewAllocation()
  await service.publish()
  const load = (await repo.getSnapshot()).loads[0]
  for (const item of load.items) await service.setLoaded(load.id, item.outlet, item.expected)
  for (const key of ['refrigeration', 'condition', 'restraints'] as const)
    await service.setCheck(load.id, key, true)
  await service.attachLoadingPhoto(load.id, photo())
  await service.completeLoading(load.id)
  await service.release(load.id)
  await service.startRoute()
  await service.arrive('STOP001')
}
describe('shared demo workflows and persistence', () => {
  it('retains all sixty source fleet identities and invalidates review after undo', async () => {
    const initial = await repo.getSnapshot()
    expect(initial.vehicles).toHaveLength(60)
    expect(initial.vehicles.find((vehicle) => vehicle.id === 'VEH087')).toMatchObject({
      brand: 'Tech',
      type: 'Truck',
      status: 'Offline',
    })
    expect(initial.vehicles.some((vehicle) => vehicle.id === 'VEH060')).toBe(false)
    await service.autoAllocate()
    await service.updateSettings({ cutoffClosed: true })
    await expect(service.publish()).rejects.toThrow('review')
    await service.reviewAllocation()
    await service.unallocate('ORD1083')
    expect((await repo.getSnapshot()).settings.allocationReviewed).toBe(false)
    await service.allocate('ORD1083', 'VEH003', 2)
    await expect(service.publish()).rejects.toThrow('review')
  })
  it('retains source team identities and validates mobile invitations and access changes', async () => {
    const before = await repo.getSnapshot()
    expect(before.members).toHaveLength(6)
    expect(before.members.find((member) => member.id === 'USR002')?.name).toBe('Kasun Fernando')
    await expect(
      service.inviteByMobile({
        name: 'New Person',
        mobile: 'invalid',
        role: 'driver',
        depot: 'Kandy',
        assignment: 'VEH012',
      }),
    ).rejects.toThrow('mobile')
    await service.inviteByMobile({
      name: 'New Person',
      mobile: '+94 77 112 2334',
      role: 'driver',
      depot: 'Kandy',
      assignment: 'VEH012',
    })
    const invited = (await repo.getSnapshot()).members.find(
      (member) => member.name === 'New Person',
    )!
    expect(invited.status).toBe('Invited')
    await service.completeInvitation(invited.id)
    await service.resetAccess(invited.id)
    await service.changeAssignment(invited.id, 'Peliyagoda', 'VEH019')
    await service.updateMember(invited.id, 'loader')
    await service.suspend(invited.id)
    const reloaded = await new DexieOperationsRepository(db).getSnapshot()
    expect(reloaded.members.find((member) => member.id === invited.id)).toMatchObject({
      status: 'Suspended',
      role: 'loader',
      accessState: 'Recovery requested',
    })
    expect(reloaded.audit[0].actor).toBe('Administrator')
  })
  it('confirms both store records atomically and preserves them after reload', async () => {
    const inputs = [
      { temperature: 'Chilled' as const, cases: 19, weight: 125, volume: 1.3, window: '05:30' },
      { temperature: 'Ambient' as const, cases: 24, weight: 240, volume: 2.4, window: '06:00' },
    ]
    await expect(
      service.confirmStoreOrders([inputs[0], { ...inputs[1], cases: 0 }]),
    ).rejects.toThrow('between 1 and 100')
    expect((await repo.getSnapshot()).orders.find((order) => order.id === 'ORD1042')?.cases).toBe(
      18,
    )
    await service.confirmStoreOrders(inputs)
    const reloaded = await new DexieOperationsRepository(db).getSnapshot()
    expect(reloaded.orders.find((order) => order.id === 'ORD1042')).toMatchObject({
      cases: 19,
      weight: 125,
      volume: 1.3,
    })
    expect(reloaded.orders.find((order) => order.id === 'ORD1043')).toMatchObject({
      cases: 24,
      weight: 240,
    })
    await service.updateSettings({ cutoffClosed: true })
    await expect(service.confirmStoreOrders(inputs)).rejects.toThrow('Intake is closed')
  })
  it('projects the published manifest from manual allocations rather than stale seed quantities', async () => {
    await service.autoAllocate()
    await service.allocate('ORD1042', 'VEH001', 2)
    await service.updateSettings({ cutoffClosed: true })
    await service.reviewAllocation()
    await service.publish()
    const s = await repo.getSnapshot()
    expect(s.stops.some((stop) => stop.orderIds.includes('ORD1042'))).toBe(false)
    expect(s.loads[0].items.reduce((n, item) => n + item.expected, 0)).toBe(14)
  })
  it('proposes all 24 valid allocations and enforces gated handoff', async () => {
    await expect(service.release('LOAD055-1')).rejects.toThrow('Publish')
    await service.autoAllocate()
    let s = await repo.getSnapshot()
    expect(s.orders.filter((o) => o.status === 'Allocated')).toHaveLength(24)
    expect(s.orders.find((o) => o.id === 'ORD1042')?.vehicleId).toBe('VEH055')
    await expect(service.publish()).rejects.toThrow('cutoff')
    await service.updateSettings({ cutoffClosed: true })
    await service.reviewAllocation()
    await service.publish()
    await expect(service.completeLoading('LOAD055-1')).rejects.toThrow('Reconcile')
    await prepareTripAfterPublication()
    s = await repo.getSnapshot()
    expect(s.loads[0].released).toBe(true)
    expect(s.vehicles.find((v) => v.id === 'VEH055')?.status).toBe('En route')
  })
  it('retains proof through reload and failed sync, then updates delivery without confirming store receipt', async () => {
    await prepareTrip()
    const signature = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    await service.saveDeliveryProof('STOP001', photo(), 18, 'Thilini', '', signature)
    const reloaded = new DexieOperationsRepository(db)
    let s = await reloaded.getSnapshot()
    expect(s.stops[0].status).toBe('Proof pending')
    const saved = await reloaded.getEvidence(s.queue[0].evidenceId)
    expect(saved?.photo.size).toBeGreaterThan(0)
    expect(saved?.signature?.size).toBe(signature.size)
    await service.updateSettings({ syncOutcome: 'retry' })
    await service.sync(true)
    s = await repo.getSnapshot()
    expect(s.queue[0].status).toBe('retry')
    expect(s.stops[0].status).toBe('Proof pending')
    await service.updateSettings({ syncOutcome: 'accepted' })
    await service.sync(true)
    s = await repo.getSnapshot()
    expect(s.queue[0].status).toBe('accepted')
    expect(s.orders.find((o) => o.id === 'ORD1042')).toMatchObject({
      status: 'Delivered',
      receipt: 'Pending',
    })
    await service.confirmReceipt('ORD1042')
    expect((await repo.getSnapshot()).orders.find((o) => o.id === 'ORD1042')?.receipt).toBe(
      'Confirmed',
    )
  })
  it('preserves old evidence when a route revision requires review', async () => {
    await prepareTrip()
    await service.saveDeliveryProof('STOP001', photo(), 18, 'Thilini', '')
    await service.updateSettings({ routeRevision: 4 })
    await service.sync(true)
    let s = await repo.getSnapshot()
    expect(s.queue[0].status).toBe('review')
    const evidence = await repo.getEvidence(s.queue[0].evidenceId)
    expect(evidence?.revision).toBe(3)
    await service.reviewQueuedRecord(s.queue[0].id)
    await service.sync(true)
    s = await repo.getSnapshot()
    expect(s.queue[0].status).toBe('accepted')
    expect((await repo.getEvidence(s.queue[0].evidenceId))?.revision).toBe(3)
  })
  it('keeps the entire record when offline and rejects duplicate proof', async () => {
    await prepareTrip()
    await service.saveDeliveryProof('STOP001', photo(), 18, 'Thilini', '')
    await expect(service.sync(false)).rejects.toThrow('offline')
    await expect(service.saveDeliveryProof('STOP001', photo(), 18, 'Thilini', '')).rejects.toThrow(
      'already waiting',
    )
    expect((await repo.getSnapshot()).queue).toHaveLength(1)
  })
  it('rolls back the photograph and queue if saving the business record fails', async () => {
    const evidence = {
      id: 'rollback',
      kind: 'loading' as const,
      entityId: 'LOAD055-1',
      photo: photo(),
      fileName: 'proof.png',
      createdAt: new Date().toISOString(),
      revision: 3,
      accepted: false,
    }
    await expect(
      repo.saveEvidence(evidence, undefined, () => {
        throw new Error('Load changed')
      }),
    ).rejects.toThrow('Load changed')
    expect(await repo.getEvidence('rollback')).toBeUndefined()
  })
  it('does not mark a failed delivery attempt as delivered after sync', async () => {
    await prepareTrip()
    await service.saveAttemptProof('STOP001', photo(), 'Outlet closed at the receiving dock')
    await service.sync(true)
    const s = await repo.getSnapshot()
    expect(s.stops[0].status).toBe('Cannot deliver')
    expect(s.orders[0].status).not.toBe('Delivered')
  })
  it('blocks immediate suspension of an active driver', async () => {
    await prepareTrip()
    await expect(service.suspend('USR001')).rejects.toThrow('on route')
    await service.suspend('USR001', true)
    expect((await repo.getSnapshot()).members[0]).toMatchObject({
      status: 'Active',
      suspensionScheduled: true,
    })
  })
})
async function prepareTripAfterPublication() {
  const load = (await repo.getSnapshot()).loads[0]
  for (const item of load.items) await service.setLoaded(load.id, item.outlet, item.expected)
  for (const key of ['refrigeration', 'condition', 'restraints'] as const)
    await service.setCheck(load.id, key, true)
  await service.attachLoadingPhoto(load.id, photo())
  await service.completeLoading(load.id)
  await service.release(load.id)
}
