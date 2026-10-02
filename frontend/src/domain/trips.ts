import type { Snapshot, Trip } from './models'

/** Trips are projections of orders, avoiding a second mutable allocation record. */
export function tripsFromOrders(snapshot: Snapshot): Trip[] {
  const grouped = new Map<string, Trip>()
  for (const order of snapshot.orders) {
    if (!order.vehicleId || !order.trip || order.status === 'Deferred') continue
    const key = `${order.vehicleId}-${order.trip}`
    const trip = grouped.get(key) ?? {
      id: key,
      vehicleId: order.vehicleId,
      number: order.trip,
      orderIds: [],
      weight: 0,
      volume: 0,
      cases: 0,
      status: 'Planned',
    }
    trip.orderIds.push(order.id)
    trip.weight += order.weight
    trip.volume += order.volume
    trip.cases += order.cases
    grouped.set(key, trip)
  }
  for (const trip of grouped.values()) {
    const orders = snapshot.orders.filter((order) => trip.orderIds.includes(order.id))
    trip.status = orders.every((order) => order.status === 'Delivered')
      ? 'Complete'
      : orders.some((order) => order.status === 'En route')
        ? 'En route'
        : snapshot.settings.published
          ? 'Scheduled'
          : 'Planned'
  }
  return [...grouped.values()]
}
