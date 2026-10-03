import type { Order, Stop } from './models'

/** Manager sign-off is bound to the reviewed handoff, not reusable on edited details. */
export type SignaturePoint = { x: number; y: number }
export type SignatureStroke = SignaturePoint[]
export interface ReceivedOrder {
  orderId: string
  expected: number
  received: number
}
export interface ManagerSignOff {
  method: 'signature'
  managerName: string
  remarks: string
  unloaded: boolean
  orders: ReceivedOrder[]
  strokes: SignatureStroke[]
  signedAt: string
  photoDigest: string
  binding: string
}
export interface SignedHandoff {
  stopId: string
  quantity: number
  receiver: string
  exception: string
  fileName: string
  revision: number
}
export function hasSignatureInk(strokes: SignatureStroke[]) {
  if (strokes.flat().length < 5 || strokes.flat().length > 10000) return false
  let distance = 0
  for (const stroke of strokes) {
    for (let index = 0; index < stroke.length; index++) {
      const point = stroke[index]
      if (![point.x, point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return false
      if (index)
        distance += Math.hypot(point.x - stroke[index - 1].x, point.y - stroke[index - 1].y)
    }
  }
  return distance >= 0.15
}
export function signOffBinding(handoff: SignedHandoff, signOff: Omit<ManagerSignOff, 'binding'>) {
  return JSON.stringify({
    stopId: handoff.stopId,
    quantity: handoff.quantity,
    receiver: handoff.receiver.trim(),
    exception: handoff.exception.trim(),
    fileName: handoff.fileName,
    revision: handoff.revision,
    remarks: signOff.remarks.trim(),
    orders: signOff.orders,
    strokes: signOff.strokes,
    unloaded: signOff.unloaded,
    managerName: signOff.managerName.trim(),
    signedAt: signOff.signedAt,
    photoDigest: signOff.photoDigest,
  })
}
export function managerSignOffErrors(
  handoff: SignedHandoff,
  signature?: Blob,
  signOff?: ManagerSignOff,
) {
  if (!signature || !signOff)
    return ['Store Manager e-signature is required before delivery completion.']
  const errors: string[] = []
  if (
    signature.type !== 'image/png' ||
    !signature.size ||
    signature.size > 1024 * 1024 ||
    !hasSignatureInk(signOff.strokes)
  )
    errors.push('Draw a valid Store Manager signature.')
  if (
    signOff.method !== 'signature' ||
    signOff.managerName.trim().length < 2 ||
    signOff.managerName.trim() !== handoff.receiver.trim()
  )
    errors.push('Record the signing Store Manager’s name.')
  if (signOff.remarks.trim().length < 4)
    errors.push('Store Manager remarks are required before signing.')
  if (!signOff.unloaded)
    errors.push('The Store Manager must confirm the orders were unloaded and checked.')
  if (
    !signOff.orders.length ||
    new Set(signOff.orders.map((order) => order.orderId)).size !== signOff.orders.length ||
    signOff.orders.some(
      (order) =>
        !order.orderId ||
        !Number.isInteger(order.expected) ||
        order.expected < 0 ||
        !Number.isInteger(order.received) ||
        order.received < 0 ||
        order.received > order.expected,
    ) ||
    signOff.orders.reduce((sum, order) => sum + order.received, 0) !== handoff.quantity
  )
    errors.push('Reconcile the received quantity for every unloaded order.')
  if (
    !Number.isFinite(Date.parse(signOff.signedAt)) ||
    !/^[a-f0-9]{64}$/.test(signOff.photoDigest) ||
    signOff.binding !== signOffBinding(handoff, signOff)
  )
    errors.push('Handoff details changed after signing. Ask the Store Manager to sign again.')
  return errors
}

/** Compare every expected quantity, including manifests with the same total. */
export function signedManifestMatches(
  stop: Pick<Stop, 'orderIds'>,
  orders: Order[],
  signOff?: ManagerSignOff,
) {
  return (
    !!signOff &&
    stop.orderIds.length === signOff.orders.length &&
    stop.orderIds.every(
      (orderId) =>
        signOff.orders.find((item) => item.orderId === orderId)?.expected ===
        orders.find((order) => order.id === orderId)?.cases,
    )
  )
}
