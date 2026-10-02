import { describe, expect, it } from 'vitest'
import { createSeed } from '../infrastructure/demo/seed'
import { allocationErrors, departureErrors, loadErrors, publicationErrors } from './rules'

describe('operational rules', () => {
  it('rejects chilled cargo on ambient vehicles and a third trip', () => {
    const s = createSeed()
    expect(allocationErrors(s.orders[0], { ...s.vehicles[0], reefer: false }, 3, [])).toEqual(
      expect.arrayContaining([
        'Chilled cargo requires a refrigerated vehicle.',
        'A vehicle can make at most two trips per day.',
      ]),
    )
  })
  it('checks aggregate weight and volume independently', () => {
    const s = createSeed(),
      vehicle = s.vehicles[54]
    const peer = {
      ...s.orders[0],
      id: 'peer',
      weight: 750,
      volume: 3.8,
      vehicleId: vehicle.id,
      trip: 1,
    }
    const errors = allocationErrors(s.orders[0], vehicle, 1, [peer])
    expect(errors).toContain('This trip exceeds the weight limit.')
    expect(errors).toContain('This trip exceeds the volume limit.')
  })
  it('requires cutoff, allocation, deferral reasons, and priority restoration', () => {
    const s = createSeed()
    s.orders = [{ ...s.orders[5], status: 'Deferred' }]
    expect(publicationErrors(s)).toEqual(
      expect.arrayContaining([
        'Close intake at the 16:00 cutoff before publishing.',
        'ORD1065 needs a deferral reason.',
        'OUT057 was previously skipped and must be served.',
      ]),
    )
  })
  it('does not treat publication as departure readiness', () => {
    const s = createSeed()
    s.settings.published = true
    expect(departureErrors(s, s.loads[0])).toContain('Attach a loading photograph.')
    expect(loadErrors(s.loads[0])).toContain('Complete all three safety checks.')
  })
})
