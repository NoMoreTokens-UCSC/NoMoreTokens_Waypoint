import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WaypointDatabase } from '../infrastructure/persistence/database'
import { DexieOperationsRepository } from '../infrastructure/persistence/DexieOperationsRepository'
import { DriverSignalsService } from './DriverSignalsService'
import { OperationsService } from './OperationsService'

let db: WaypointDatabase, repository: DexieOperationsRepository, signals: DriverSignalsService
beforeEach(async () => {
  db = new WaypointDatabase(`driver-signals-${crypto.randomUUID()}`)
  repository = new DexieOperationsRepository(db)
  signals = new DriverSignalsService(repository)
  await repository.getSnapshot()
})
afterEach(async () => {
  db.close()
  await db.delete()
})
describe('frontend delivery signals', () => {
  it('retains only the latest GPS fix per assigned vehicle and survives reload offline', async () => {
    const fix = {
      vehicleId: 'VEH055',
      lat: 6.98,
      lng: 79.91,
      accuracy: 12,
      recordedAt: '2026-10-03T01:00:00Z',
    }
    await expect(signals.recordPosition(fix)).rejects.toThrow('active assigned route')
    await repository.update((snapshot) => {
      snapshot.settings.routeStarted = true
      for (const stop of snapshot.stops)
        for (const orderId of stop.orderIds) {
          const order = snapshot.orders.find((item) => item.id === orderId)!
          order.vehicleId = 'VEH055'
          order.trip = 1
        }
      snapshot.settings.simulatedOffline = true
    })
    await signals.recordPosition(fix)
    await signals.recordPosition({ ...fix, lat: 6.99, recordedAt: '2026-10-03T01:01:00Z' })
    await signals.recordPosition(fix)
    const reloaded = new DriverSignalsService(new DexieOperationsRepository(db))
    expect(await reloaded.pendingPositions()).toEqual([
      { ...fix, lat: 6.99, recordedAt: '2026-10-03T01:01:00Z' },
    ])
    expect(
      (await repository.getSnapshot()).vehicles.find((vehicle) => vehicle.id === 'VEH055'),
    ).toMatchObject({ lat: 6.99, positionSource: 'device', positionAccuracy: 12 })
    await expect(signals.recordPosition({ ...fix, vehicleId: 'VEH001' })).rejects.toThrow(
      'assigned route',
    )
    await expect(signals.recordPosition({ ...fix, lat: 200 })).rejects.toThrow('invalid')
  })
  it('keeps Web Push registration local and rejects invalid endpoints or outlet assignments', async () => {
    const subscription = {
      outletId: 'OUT001',
      endpoint: 'https://push.example.test/device',
      expirationTime: null,
      keys: { auth: 'mock-auth', p256dh: 'mock-key' },
      createdAt: '2026-10-03T01:00:00Z',
    }
    await signals.registerPushSubscription(subscription)
    await signals.registerPushSubscription(subscription)
    expect(
      (await new DexieOperationsRepository(db).getSnapshot()).pendingPushSubscriptions,
    ).toEqual([subscription])
    await expect(
      signals.registerPushSubscription({
        ...subscription,
        endpoint: 'http://push.example.test/device',
      }),
    ).rejects.toThrow('Invalid')
    await expect(
      signals.registerPushSubscription({ ...subscription, outletId: 'OUT008' }),
    ).rejects.toThrow('active Store Manager')
  })
  it('persists outlet-scoped alerts and acknowledgement, deduplicating deadline checks', async () => {
    await repository.update((snapshot) => {
      snapshot.settings.routeStarted = true
      for (const stop of snapshot.stops)
        for (const orderId of stop.orderIds) {
          const order = snapshot.orders.find((item) => item.id === orderId)!
          order.vehicleId = 'VEH055'
          order.trip = 1
        }
    })
    const service = new OperationsService(repository, {
      submit: async () => ({ status: 'accepted', message: 'demo' }),
    })
    await service.arrive('STOP001')
    await repository.update((snapshot) => {
      snapshot.stops[0].arrivedAt = '2026-10-03T07:20:00+05:30'
    })
    await signals.checkDeliveryWindows('2026-10-03T07:45:00+05:30')
    expect((await signals.listNotices('OUT001')).some((notice) => notice.kind === 'deadline')).toBe(
      false,
    )
    await repository.update((snapshot) => {
      snapshot.stops[0].arrivedAt = '2026-10-03T07:40:00+05:30'
    })
    await service.reportDelay('STOP001', 'Loading dock occupied')
    await signals.checkDeliveryWindows('2026-10-03T07:45:00+05:30')
    await signals.checkDeliveryWindows('2026-10-03T07:46:00+05:30')
    const notices = await signals.listNotices('OUT001')
    expect(notices.map((notice) => notice.kind).sort()).toEqual(['arrival', 'deadline', 'delay'])
    expect(notices.every((notice) => notice.delivery === 'local')).toBe(true)
    await signals.acknowledgeNotice(notices[0].id)
    const reloaded = new DriverSignalsService(new DexieOperationsRepository(db))
    expect((await reloaded.listNotices('OUT001'))[0].readAt).toBeDefined()
    expect(
      (await reloaded.listNotices('OUT008')).every((notice) => notice.outletId === 'OUT008'),
    ).toBe(true)
  })
})
