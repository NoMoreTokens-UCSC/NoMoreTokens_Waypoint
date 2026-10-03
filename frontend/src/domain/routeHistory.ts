import type { Snapshot, Stop } from './models'
import { assignedDriverLoad, deliveryDay } from './driverWorkflow'

export type RouteEventKind =
  | 'loaderConfirmed'
  | 'released'
  | 'started'
  | 'arrived'
  | 'proofSaved'
  | 'accepted'
  | 'delay'
  | 'breakdown'
  | 'attempt'
  | 'reopened'
  | 'completed'
export interface RouteEvent {
  id: string
  at: string
  day: string
  vehicleId: string
  trip: number
  revision: number
  kind: RouteEventKind
  detail: string
  stopId?: string
  outletId?: string
}

export function recordRouteEvent(
  snapshot: Snapshot,
  kind: RouteEventKind,
  detail: string,
  stop?: Stop,
) {
  const load = assignedDriverLoad(snapshot)
  if (!load) return
  const at = new Date().toISOString()
  ;(snapshot.routeEvents ??= []).push({
    id: crypto.randomUUID(),
    at,
    day: deliveryDay(
      ['loaderConfirmed', 'released'].includes(kind)
        ? at
        : (snapshot.settings.routeStartedAt ?? at),
    ),
    vehicleId: load.vehicleId,
    trip: load.trip,
    revision: snapshot.settings.routeRevision,
    kind,
    detail,
    stopId: stop?.id,
    outletId: stop?.outlet,
  })
}
