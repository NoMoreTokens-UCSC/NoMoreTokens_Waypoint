import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptySeed } from '../demo/seed'
import { DexieOperationsRepository } from './DexieOperationsRepository'
import { WaypointDatabase } from './database'

let db: WaypointDatabase
beforeEach(() => {
  db = new WaypointDatabase(`real-backend-${crypto.randomUUID()}`)
})
afterEach(async () => {
  db.close()
  await db.delete()
})

describe('starting without demo data for a real backend', () => {
  it('a fresh browser starts empty', async () => {
    const snapshot = await new DexieOperationsRepository(db, {
      seed: createEmptySeed,
      purgeDemo: true,
    }).getSnapshot()
    expect(snapshot.orders).toEqual([])
    expect(snapshot.vehicles).toEqual([])
    expect(snapshot.members).toEqual([])
    expect(snapshot.orderHistory).toEqual([])
    expect(snapshot.settings.profileName).toBe('')
  })

  it('replaces sample data left by an earlier demo session, once', async () => {
    const demo = await new DexieOperationsRepository(db).getSnapshot()
    expect(demo.orders.length).toBeGreaterThan(0)
    expect(demo.members.length).toBeGreaterThan(0)

    const real = () =>
      new DexieOperationsRepository(db, { seed: createEmptySeed, purgeDemo: true })
    const cleaned = await real().getSnapshot()
    expect(cleaned.orders).toEqual([])
    expect(cleaned.members).toEqual([])
    expect(cleaned.queue).toEqual([])

    // Device state written afterwards is kept: the clean-up does not run again.
    await real().update((snapshot) => {
      snapshot.settings.notifications = false
    })
    expect((await real().getSnapshot()).settings.notifications).toBe(false)
  })
})
