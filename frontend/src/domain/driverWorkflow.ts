import type { Load, Order, Snapshot, Stop } from './models'
import { departureErrors } from './rules'

export function assignedDriverLoad(snapshot: Snapshot) {
  const driver = snapshot.members.find(
    (member) => member.id === (snapshot.activeDriverId ?? 'USR001'),
  )
  return driver?.role === 'driver' && driver.status === 'Active'
    ? snapshot.loads.find((load) => load.vehicleId === driver.vehicleId && load.trip === 1)
    : undefined
}

export function isAssignedStop(stop: Stop, orders: Order[], load: Load | undefined) {
  return (
    !!load &&
    stop.orderIds.length > 0 &&
    stop.orderIds.every((id) => {
      const order = orders.find((item) => item.id === id)
      return (
        order?.outlet === stop.outlet &&
        order.vehicleId === load.vehicleId &&
        order.trip === load.trip
      )
    })
  )
}

export function driverDepartureErrors(snapshot: Snapshot) {
  const load = assignedDriverLoad(snapshot)
  if (!load) return ['An active driver and assigned truck are required.']
  return [
    ...departureErrors(snapshot, load),
    ...(load.revision !== snapshot.settings.routeRevision
      ? ['Review the Loader confirmation for the current route revision.']
      : []),
    ...(!load.released ? ['Dispatcher must release this assigned truck.'] : []),
    ...(!snapshot.stops.some(
      (stop) =>
        isAssignedStop(stop, snapshot.orders, load) &&
        ['Upcoming', 'Arrived'].includes(stop.status),
    )
      ? ['No open deliveries are assigned to this truck.']
      : []),
  ]
}

export function nextDriverStop<T extends Stop>(stops: T[]) {
  return (
    stops.find((stop) => stop.status === 'Arrived') ??
    stops.find((stop) => stop.status === 'Upcoming') ??
    stops.find((stop) => stop.status === 'Proof pending')
  )
}

export function deliveryDay(at: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at))
}
