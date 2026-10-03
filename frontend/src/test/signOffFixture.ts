import {
  signOffBinding,
  type ReceivedOrder,
  type SignedHandoff,
} from '../domain/deliveryVerification'

export function signOffFixture(
  handoff: SignedHandoff,
  photoDigest = 'a'.repeat(64),
  orders: ReceivedOrder[] = [
    { orderId: 'order', expected: handoff.quantity, received: handoff.quantity },
  ],
) {
  const signature = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  const details = {
    method: 'signature' as const,
    managerName: handoff.receiver,
    remarks: 'Quantities checked at unloading.',
    unloaded: true,
    orders,
    strokes: [
      [
        { x: 0.1, y: 0.2 },
        { x: 0.2, y: 0.5 },
        { x: 0.3, y: 0.2 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.2 },
      ],
    ],
    signedAt: '2026-09-26T00:10:00Z',
    photoDigest,
  }
  return { signature, managerSignOff: { ...details, binding: signOffBinding(handoff, details) } }
}
