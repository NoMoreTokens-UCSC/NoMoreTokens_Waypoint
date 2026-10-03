import { freshWindowErrors } from './deliveryWindow'
import type { Load, Order, Snapshot, Vehicle } from './models'

export function allocationErrors(
  order: Order,
  vehicle: Vehicle,
  trip: number,
  orders: Order[],
): string[] {
  const errors: string[] = []
  const peers = orders.filter(
    (o) =>
      o.id !== order.id && o.vehicleId === vehicle.id && o.trip === trip && o.status !== 'Deferred',
  )
  if (order.brand === 'Fresh') errors.push(...freshWindowErrors(order.window, order.windowEnd))
  if (trip < 1 || trip > 2) errors.push('A vehicle can make at most two trips per day.')
  if (order.temperature === 'Chilled' && !vehicle.reefer)
    errors.push('Chilled cargo requires a refrigerated vehicle.')
  if (order.brand !== vehicle.brand)
    errors.push('Choose a vehicle assigned to the same demand type.')
  if (order.weight + peers.reduce((n, o) => n + o.weight, 0) > vehicle.weightCapacity)
    errors.push('This trip exceeds the weight limit.')
  if (order.volume + peers.reduce((n, o) => n + o.volume, 0) > vehicle.volumeCapacity)
    errors.push('This trip exceeds the volume limit.')
  return errors
}

export function publicationErrors(snapshot: Snapshot): string[] {
  const errors: string[] = []
  if (!snapshot.settings.cutoffClosed)
    errors.push('Close intake at the 16:00 cutoff before publishing.')
  for (const o of snapshot.orders) {
    if (o.status === 'Confirmed') errors.push(`${o.id} still needs an allocation or deferral.`)
    if (o.status === 'Deferred') {
      if (!o.deferralReason?.trim()) errors.push(`${o.id} needs a deferral reason.`)
      if (o.priority) errors.push(`${o.outlet} was previously skipped and must be served.`)
    } else if (o.vehicleId) {
      const vehicle = snapshot.vehicles.find((v) => v.id === o.vehicleId)
      if (!vehicle) errors.push(`${o.id} references a missing vehicle.`)
      else
        errors.push(
          ...allocationErrors(o, vehicle, o.trip ?? 1, snapshot.orders).map((e) => `${o.id}: ${e}`),
        )
    }
  }
  return [...new Set(errors)]
}

export function loadErrors(load: Load, requirePhoto = true): string[] {
  const errors: string[] = []
  if (!load.items.length) errors.push('Allocate demand to this vehicle before loading.')
  if (load.items.some((i) => i.loaded !== i.expected))
    errors.push('Reconcile every case before continuing.')
  if (Object.values(load.checks).some((v) => !v)) errors.push('Complete all three safety checks.')
  if (load.issue && !load.issueResolved)
    errors.push('Resolve the reported shortfall before departure.')
  if (requirePhoto && !load.photoId) errors.push('Attach a loading photograph.')
  return errors
}

export function departureErrors(snapshot: Snapshot, load: Load): string[] {
  return [
    ...(!snapshot.settings.published ? ['Publish the reviewed plan first.'] : []),
    ...loadErrors(load),
    ...(!load.completed ? ['Confirm loading completion.'] : []),
  ]
}
