import type { Load, Snapshot } from './models'

export function loadSummary(snapshot: Snapshot, load: Load) {
  const vehicle = snapshot.vehicles.find((item) => item.id === load.vehicleId)
  const orderIds = new Set(
    snapshot.stops
      .filter((stop) => load.items.some((item) => item.outlet === stop.outlet))
      .flatMap((stop) => stop.orderIds),
  )
  const orders = snapshot.orders.filter((order) => orderIds.has(order.id))
  return {
    vehicle,
    cases: load.items.reduce((sum, item) => sum + item.expected, 0),
    loaded: load.items.reduce((sum, item) => sum + item.loaded, 0),
    loadedStops: load.items.filter((item) => item.loaded === item.expected).length,
    weight: orders.reduce((sum, order) => sum + order.weight, 0),
    volume: orders.reduce((sum, order) => sum + order.volume, 0),
  }
}
