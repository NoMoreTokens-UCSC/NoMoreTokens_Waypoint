import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointDatabase } from '../infrastructure/persistence/database'
import { DexieOperationsRepository } from '../infrastructure/persistence/DexieOperationsRepository'
import { OperationsService } from './OperationsService'
import { signOffFixture } from '../test/signOffFixture'
import { photoDigest } from '../domain/photoDigest'
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
  vi.useRealTimers()
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
async function saveSignedProof(
  stopId: string,
  file: File,
  quantity: number,
  receiver: string,
  exception: string,
  signature?: Blob,
  capturedRevision?: number,
) {
  const snapshot = await repo.getSnapshot()
  const stop = snapshot.stops.find((item) => item.id === stopId)!
  const handoff = {
    stopId,
    quantity,
    receiver,
    exception,
    fileName: file.name,
    revision: capturedRevision ?? snapshot.settings.routeRevision,
  }
  const orders = stop.orderIds.map((orderId) => ({
    orderId,
    expected: snapshot.orders.find((order) => order.id === orderId)!.cases,
    received: quantity,
  }))
  const signed = signOffFixture(handoff, await photoDigest(file), orders)
  return service.saveDeliveryProof(
    stopId,
    file,
    quantity,
    receiver,
    exception,
    signature ?? signed.signature,
    capturedRevision,
    signed.managerSignOff,
  )
}
describe('shared demo workflows and persistence', () => {
  it('checks Loader confirmation and the assigned truck even when a release flag is stale', async () => {
    await service.autoAllocate()
    await service.updateSettings({ cutoffClosed: true })
    await service.reviewAllocation()
    await service.publish()
    await repo.update((snapshot) => {
      snapshot.loads[0].released = true
    })
    await expect(service.startRoute()).rejects.toThrow('safety checks')
    await repo.update((snapshot) => {
      const load = snapshot.loads[0]
      load.completed = true
      load.photoId = 'loader-photo'
      load.checks = { refrigeration: true, condition: true, restraints: true }
      load.items.forEach((item) => {
        item.loaded = item.expected
      })
      snapshot.members.find((member) => member.id === 'USR001')!.vehicleId = 'VEH056'
    })
    await expect(service.startRoute()).rejects.toThrow('assigned truck')
    expect((await repo.getSnapshot()).settings.routeStarted).toBe(false)
  })
  it('rejects an outlet from another truck and prevents a second arrival during an open handoff', async () => {
    await prepareTrip()
    await expect(service.arrive('STOP008')).rejects.toThrow('current outlet')
    await repo.update((snapshot) => {
      const stop = snapshot.stops.find((item) => item.id === 'STOP001')!
      snapshot.orders.find((order) => stop.orderIds.includes(order.id))!.vehicleId = 'VEH056'
    })
    await expect(saveSignedProof('STOP001', photo(), 18, 'Nimal', '')).rejects.toThrow('Arrive')
    expect((await repo.getSnapshot()).queue).toHaveLength(0)
  })
  it('stores route timestamps and a revised breakdown ETA without cancelling or extending the window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T06:00:00+05:30'))
    await prepareTrip()
    vi.setSystemTime(new Date('2026-10-03T06:15:00+05:30'))
    await service.reportDelay(
      'STOP008',
      'Engine failure, awaiting replacement truck',
      '08:20',
      'breakdown',
    )
    const snapshot = await new DexieOperationsRepository(db).getSnapshot()
    const stop = snapshot.stops.find((item) => item.id === 'STOP008')!
    expect(stop).toMatchObject({
      status: 'Upcoming',
      eta: '08:20',
      originalEta: '07:10',
      window: '07:00–08:00',
    })
    expect(snapshot.routeEvents?.map((event) => event.kind)).toEqual([
      'loaderConfirmed',
      'released',
      'started',
      'arrived',
      'breakdown',
    ])
    expect(
      snapshot.routeEvents?.every(
        (event) => event.vehicleId === 'VEH055' && event.day === '2026-10-03',
      ),
    ).toBe(true)
    expect(snapshot.routeEvents?.at(-1)?.at).toBe('2026-10-03T00:45:00.000Z')
    expect(
      snapshot.deliveryNotices?.some(
        (notice) => notice.outletId === stop.outlet && notice.message.includes('08:20'),
      ),
    ).toBe(true)
    await expect(service.reportDelay(stop.id, 'Invalid time', '25:00')).rejects.toThrow(
      'valid revised',
    )
  })
  it('confirms a manager handoff only for the assigned outlet and records receipt once after acceptance', async () => {
    await prepareTrip()
    const snapshot = await repo.getSnapshot()
    const file = photo()
    const handoff = {
      stopId: 'STOP001',
      quantity: 18,
      receiver: 'Nimal',
      exception: '',
      fileName: file.name,
      revision: snapshot.settings.routeRevision,
    }
    const signed = signOffFixture(handoff, await photoDigest(file), [
      { orderId: 'ORD1042', expected: 18, received: 18 },
    ])
    const proof = {
      photo: file,
      quantity: 18,
      receiver: 'Nimal',
      exception: '',
      capturedRevision: snapshot.settings.routeRevision,
      ...signed,
    }
    await expect(service.confirmManagerHandoff('OUT008', 'STOP001', proof)).rejects.toThrow(
      'your outlet',
    )
    await service.confirmManagerHandoff('OUT001', 'STOP001', proof)
    await service.sync(true)
    const current = await repo.getSnapshot()
    expect(current.orders.find((order) => order.id === 'ORD1042')?.receipt).toBe('Confirmed')
    expect(current.routeEvents?.map((event) => event.kind)).toContain('accepted')
    await expect(service.confirmManagerHandoff('OUT001', 'STOP001', proof)).rejects.toThrow(
      'Arrive',
    )
    expect(current.queue).toHaveLength(1)
  })
  it('persists a captured Driver draft across repository reload without completing a stop', async () => {
    await prepareTrip()
    await service.saveProofDraft({
      stopId: 'STOP001',
      photo: photo(),
      fileName: 'proof.png',
      stage: 'captured',
      quantity: 18,
      receiver: '',
      acknowledged: false,
      exception: '',
      revision: 3,
      createdAt: new Date().toISOString(),
    })
    const reloaded = new DexieOperationsRepository(db)
    expect((await reloaded.getProofDraft('STOP001'))?.photo.size).toBeGreaterThan(0)
    expect((await reloaded.getSnapshot()).stops[0].status).toBe('Arrived')
    expect((await reloaded.getSnapshot()).queue).toHaveLength(0)
    await service.updateSettings({ routeRevision: 4 })
    expect((await reloaded.getProofDraft('STOP001'))?.revision).toBe(3)
    await reloaded.deleteProofDraft('STOP001')
    expect(await reloaded.listProofDrafts()).toHaveLength(0)
  })
  it('keeps the capture revision when a draft is submitted after the route changes', async () => {
    await prepareTrip()
    await service.updateSettings({ routeRevision: 4 })
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '', undefined, 3)
    await service.sync(true)
    const current = await repo.getSnapshot()
    expect(current.queue[0]).toMatchObject({ status: 'review', revision: 3 })
    expect(current.stops[0].status).toBe('Proof pending')
  })
  it('replaces a captured draft with queued proof atomically and retains the draft on validation failure', async () => {
    await prepareTrip()
    await service.saveProofDraft({
      stopId: 'STOP001',
      photo: photo(),
      fileName: 'proof.png',
      stage: 'attached',
      quantity: 18,
      receiver: 'Nimal',
      acknowledged: true,
      exception: '',
      revision: 3,
      createdAt: new Date().toISOString(),
    })
    await expect(service.saveDeliveryProof('STOP001', photo(), -1, 'Nimal', '')).rejects.toThrow(
      'case count',
    )
    expect(await repo.getProofDraft('STOP001')).toBeDefined()
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '')
    expect(await repo.getProofDraft('STOP001')).toBeUndefined()
    expect((await repo.getSnapshot()).queue[0].status).toBe('pending')
  })
  it('rejects draft capture before parking and records a delay without cancelling delivery', async () => {
    const draft = {
      stopId: 'STOP001',
      photo: photo(),
      fileName: 'proof.png',
      stage: 'captured' as const,
      quantity: 18,
      receiver: '',
      acknowledged: false,
      exception: '',
      revision: 3,
      createdAt: new Date().toISOString(),
    }
    await expect(service.saveProofDraft(draft)).rejects.toThrow('Park')
    await prepareTrip()
    await service.reportDelay('STOP001', 'Waiting for the receiving team')
    expect((await repo.getSnapshot()).stops[0]).toMatchObject({
      status: 'Arrived',
      issue: 'Delay: Waiting for the receiving team',
    })
  })
  it('changes a failed upload to syncing on explicit retry before acceptance', async () => {
    await prepareTrip()
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '')
    await service.updateSettings({ syncOutcome: 'retry' })
    await service.sync(true)
    let finishUpload!: () => void
    const controlledGateway: SyncGateway = {
      submit: async () => {
        await new Promise<void>((resolve) => {
          finishUpload = resolve
        })
        return { status: 'accepted', message: 'Test acknowledgement' }
      },
    }
    const retryService = new OperationsService(repo, controlledGateway)
    const upload = retryService.sync(true)
    await expect.poll(async () => (await repo.getSnapshot()).queue[0].status).toBe('syncing')
    expect((await repo.getSnapshot()).stops[0].status).toBe('Proof pending')
    finishUpload()
    await upload
    expect((await repo.getSnapshot()).stops[0].status).toBe('Delivered')
  })
  it('automatic sync of a new pending stop does not retry an older failed proof', async () => {
    await prepareTrip()
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '')
    await service.updateSettings({ syncOutcome: 'retry' })
    await service.sync(true)
    await service.arrive('STOP008')
    await saveSignedProof('STOP008', photo(), 14, 'Nimal', '')
    await service.updateSettings({ syncOutcome: 'accepted' })
    await service.sync(true, false)
    let current = await repo.getSnapshot()
    expect(current.queue.find((record) => record.stopId === 'STOP001')?.status).toBe('retry')
    expect(current.stops.find((stop) => stop.id === 'STOP001')?.status).toBe('Proof pending')
    expect(current.queue.find((record) => record.stopId === 'STOP008')?.status).toBe('accepted')
    await service.sync(true)
    current = await repo.getSnapshot()
    expect(current.stops.every((stop) => stop.status === 'Delivered')).toBe(true)
  })
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
  it('retains proof through reload and failed sync, then records the signed store receipt', async () => {
    await prepareTrip()
    const signature = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    await saveSignedProof('STOP001', photo(), 18, 'Thilini', '', signature)
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
      receipt: 'Confirmed',
      deliveredAt: saved?.managerSignOff?.signedAt,
    })
    await service.confirmReceipt('ORD1042')
    expect((await repo.getSnapshot()).orders.find((o) => o.id === 'ORD1042')?.receipt).toBe(
      'Confirmed',
    )
  })
  it('preserves old evidence when a route revision requires review', async () => {
    await prepareTrip()
    await saveSignedProof('STOP001', photo(), 18, 'Thilini', '')
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
    await saveSignedProof('STOP001', photo(), 18, 'Thilini', '')
    await expect(service.sync(false)).rejects.toThrow('offline')
    await expect(saveSignedProof('STOP001', photo(), 18, 'Thilini', '')).rejects.toThrow(
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
  it('rejects unsigned completion and mismatched photo or order manifests without losing the draft', async () => {
    await prepareTrip()
    await expect(
      service.saveDeliveryProof('STOP001', photo(), 18, 'Nimal', 'Receiver unavailable'),
    ).rejects.toThrow('e-signature is required')
    const handoff = {
      stopId: 'STOP001',
      quantity: 18,
      receiver: 'Nimal',
      exception: '',
      fileName: 'proof.png',
      revision: 3,
    }
    const wrongPhoto = signOffFixture(handoff, 'a'.repeat(64), [
      { orderId: 'ORD1042', expected: 18, received: 18 },
    ])
    await expect(
      service.saveDeliveryProof(
        'STOP001',
        photo(),
        18,
        'Nimal',
        '',
        wrongPhoto.signature,
        3,
        wrongPhoto.managerSignOff,
      ),
    ).rejects.toThrow('photograph changed')
    const wrongOrder = signOffFixture(handoff, await photoDigest(photo()), [
      { orderId: 'ORD1043', expected: 18, received: 18 },
    ])
    await expect(
      service.saveDeliveryProof(
        'STOP001',
        photo(),
        18,
        'Nimal',
        '',
        wrongOrder.signature,
        3,
        wrongOrder.managerSignOff,
      ),
    ).rejects.toThrow('manifest')
    expect((await repo.getSnapshot()).queue).toHaveLength(0)
  })
  it('reopens legacy unsigned proof atomically, retaining history and the photo for manager sign-off', async () => {
    await prepareTrip()
    const evidence = {
      id: 'legacy',
      entityId: 'STOP001',
      kind: 'delivery' as const,
      photo: photo(),
      fileName: 'proof.png',
      quantity: 18,
      receiver: 'Nimal',
      createdAt: new Date().toISOString(),
      revision: 3,
      accepted: true,
    }
    const record = {
      id: 'legacy-queue',
      evidenceId: evidence.id,
      stopId: evidence.entityId,
      kind: 'delivery' as const,
      createdAt: evidence.createdAt,
      revision: 3,
      status: 'accepted' as const,
      attempts: 1,
    }
    await repo.saveEvidence(evidence, record, (snapshot) => {
      snapshot.stops[0].status = 'Delivered'
      snapshot.stops[0].proofId = evidence.id
    })
    await service.reopenProofForSignOff(record.id)
    const reloaded = new DexieOperationsRepository(db)
    expect((await reloaded.getSnapshot()).queue[0].status).toBe('superseded')
    expect((await reloaded.getSnapshot()).stops[0].status).toBe('Arrived')
    expect((await reloaded.getProofDraft('STOP001'))?.photo.size).toBe(evidence.photo.size)
    expect(await reloaded.getEvidence(evidence.id)).toBeDefined()
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '')
    await service.sync(true)
    expect((await reloaded.getSnapshot()).stops[0].status).toBe('Delivered')
    expect((await reloaded.getSnapshot()).queue).toHaveLength(2)
  })
  it('records a signed quantity shortfall as a store issue after acceptance', async () => {
    await prepareTrip()
    await saveSignedProof('STOP001', photo(), 16, 'Nimal', 'Two cases rejected at unloading')
    await service.sync(true)
    const order = (await repo.getSnapshot()).orders.find((item) => item.id === 'ORD1042')
    expect(order).toMatchObject({ status: 'Delivered', receipt: 'Issue reported' })
  })
  it('requires a new manager signature when a revised manifest changes unloaded quantities', async () => {
    await prepareTrip()
    await saveSignedProof('STOP001', photo(), 18, 'Nimal', '')
    const original = (await repo.getSnapshot()).queue[0]
    await repo.update((snapshot) => {
      snapshot.orders.find((order) => order.id === 'ORD1042')!.cases = 20
      snapshot.stops[0].cases = 20
      snapshot.settings.routeRevision = 4
    })
    await service.sync(true)
    expect((await repo.getSnapshot()).queue[0]).toMatchObject({
      status: 'review',
      message: expect.stringContaining('new manager signature'),
    })
    await service.reviewQueuedRecord(original.id)
    await service.sync(true)
    expect((await repo.getSnapshot()).stops[0].status).toBe('Proof pending')
    await service.reopenProofForSignOff(original.id)
    await saveSignedProof('STOP001', photo(), 20, 'Nimal', '')
    await service.sync(true)
    expect((await repo.getSnapshot()).stops[0].status).toBe('Delivered')
    expect((await repo.getSnapshot()).queue.find((item) => item.id === original.id)?.status).toBe(
      'superseded',
    )
    expect((await repo.getEvidence(original.evidenceId))?.managerSignOff?.orders[0].received).toBe(
      18,
    )
  })
  it('blocks fresh receiving times after 08:00 in order intake', async () => {
    await expect(service.createOrder('Chilled', 10, '08:30')).rejects.toThrow('before 08:00')
    await expect(
      service.confirmStoreOrders([
        {
          temperature: 'Chilled',
          cases: 10,
          weight: 100,
          volume: 1,
          window: '07:00',
          windowEnd: '09:00',
        },
        { temperature: 'Ambient', cases: 10, weight: 100, volume: 1, window: '06:00' },
      ]),
    ).rejects.toThrow('by 08:00')
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
