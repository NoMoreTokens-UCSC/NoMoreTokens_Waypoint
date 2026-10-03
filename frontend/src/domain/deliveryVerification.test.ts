import { createSeed } from '../infrastructure/demo/seed'
import { describe, expect, it } from 'vitest'
import { signOffFixture } from '../test/signOffFixture'
import {
  hasSignatureInk,
  managerSignOffErrors,
  signOffBinding,
  signedManifestMatches,
} from './deliveryVerification'
const handoff = {
  stopId: 'stop',
  quantity: 18,
  receiver: 'Nimal',
  exception: '',
  fileName: 'photo.png',
  revision: 3,
}
const signed = signOffFixture(handoff)
describe('manager e-signature validation', () => {
  it('rejects blank ink, malformed coordinates and taps', () => {
    expect(hasSignatureInk([])).toBe(false)
    expect(hasSignatureInk([[{ x: NaN, y: 0 }]])).toBe(false)
    expect(hasSignatureInk([Array.from({ length: 5 }, () => ({ x: 0.1, y: 0.1 }))])).toBe(false)
    expect(hasSignatureInk(signed.managerSignOff.strokes)).toBe(true)
  })
  it('binds signed details and requires the manager to record remarks first', () => {
    expect(managerSignOffErrors(handoff, signed.signature, signed.managerSignOff)).toEqual([])
    for (const edited of [
      { quantity: 17 },
      { receiver: 'Another manager' },
      { revision: 4 },
      { fileName: 'replacement.png' },
      { exception: 'Changed outcome' },
    ])
      expect(
        managerSignOffErrors({ ...handoff, ...edited }, signed.signature, signed.managerSignOff),
      ).not.toEqual([])
    expect(
      managerSignOffErrors(handoff, signed.signature, { ...signed.managerSignOff, remarks: '' }),
    ).toContain('Store Manager remarks are required before signing.')
  })
  it('rejects revised per-order expectations even when the total case count is unchanged', () => {
    const orders = createSeed().orders.slice(0, 2)
    const manifest = { orderIds: orders.map((order) => order.id) }
    const metadata = {
      ...signed.managerSignOff,
      orders: orders.map((order) => ({
        orderId: order.id,
        expected: order.cases,
        received: order.cases,
      })),
    }
    expect(signedManifestMatches(manifest, orders, metadata)).toBe(true)
    expect(
      signedManifestMatches(
        manifest,
        orders.map((order, index) => ({ ...order, cases: order.cases + (index ? 1 : -1) })),
        metadata,
      ),
    ).toBe(false)
  })
  it('requires every signed order to reconcile and unloading to be confirmed', () => {
    const details = {
      ...signed.managerSignOff,
      unloaded: false,
      orders: [{ orderId: 'order', expected: 18, received: 19 }],
    }
    expect(
      managerSignOffErrors(handoff, signed.signature, {
        ...details,
        binding: signOffBinding(handoff, details),
      }),
    ).toEqual(
      expect.arrayContaining([
        'The Store Manager must confirm the orders were unloaded and checked.',
        'Reconcile the received quantity for every unloaded order.',
      ]),
    )
  })
})
