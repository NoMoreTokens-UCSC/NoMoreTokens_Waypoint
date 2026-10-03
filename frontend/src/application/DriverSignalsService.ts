import type { OperationsRepository } from '../domain/ports'
import type { Snapshot, Stop } from '../domain/models'
import type {
  DeliveryNotice,
  DevicePosition,
  WebPushRegistration,
} from '../domain/api/driverSignals'
import { deliveryWindow } from '../domain/deliveryWindow'

export function addDeliveryNotice(
  snapshot: Snapshot,
  stop: Stop,
  kind: DeliveryNotice['kind'],
  title: string,
  message: string,
  suffix = '',
) {
  const key = `${snapshot.settings.routeRevision}:${stop.id}:${kind}:${suffix}`
  snapshot.deliveryNotices ??= []
  if (snapshot.deliveryNotices.some((notice) => notice.key === key)) return
  snapshot.deliveryNotices.unshift({
    id: crypto.randomUUID(),
    key,
    stopId: stop.id,
    outletId: stop.outlet,
    kind,
    title,
    message,
    createdAt: new Date().toISOString(),
    delivery: 'local',
  })
}

export class DriverSignalsService {
  constructor(private repository: OperationsRepository) {}
  registerPushSubscription(subscription: WebPushRegistration) {
    return this.repository.update((snapshot) => {
      let endpoint: URL
      try {
        endpoint = new URL(subscription.endpoint)
      } catch {
        throw new Error('Invalid push subscription endpoint.')
      }
      if (
        endpoint.protocol !== 'https:' ||
        endpoint.username ||
        endpoint.password ||
        !subscription.keys.auth ||
        !subscription.keys.p256dh ||
        !Number.isFinite(Date.parse(subscription.createdAt))
      )
        throw new Error('Invalid push subscription.')
      if (
        !snapshot.members.some(
          (member) =>
            member.role === 'store-manager' &&
            member.status === 'Active' &&
            member.outletId === subscription.outletId,
        )
      )
        throw new Error('An assigned active Store Manager is required.')
      snapshot.pendingPushSubscriptions = [
        ...(snapshot.pendingPushSubscriptions ?? []).filter(
          (item) => item.endpoint !== subscription.endpoint,
        ),
        subscription,
      ]
    })
  }
  async recordPosition(position: DevicePosition) {
    if (
      ![position.lat, position.lng, position.accuracy].every(Number.isFinite) ||
      Math.abs(position.lat) > 90 ||
      Math.abs(position.lng) > 180 ||
      position.accuracy < 0 ||
      !Number.isFinite(Date.parse(position.recordedAt))
    )
      throw new Error('The GPS position is invalid.')
    return this.repository.update((snapshot) => {
      const driver = snapshot.members.find(
        (member) => member.id === (snapshot.activeDriverId ?? 'USR001'),
      )
      const vehicle = snapshot.vehicles.find((item) => item.id === position.vehicleId)
      if (
        !snapshot.settings.routeStarted ||
        driver?.status !== 'Active' ||
        driver.vehicleId !== position.vehicleId ||
        !vehicle
      )
        throw new Error('Location updates require your active assigned route.')
      if (
        vehicle.positionUpdatedAt &&
        Date.parse(vehicle.positionUpdatedAt) >= Date.parse(position.recordedAt)
      )
        return
      Object.assign(vehicle, {
        lat: position.lat,
        lng: position.lng,
        positionAccuracy: position.accuracy,
        positionUpdatedAt: position.recordedAt,
        positionSource: 'device',
        updatedMinutes: 0,
        location: 'Device GPS · saved locally',
      })
      // Keep the latest fix per vehicle while the backend transport is unavailable.
      snapshot.pendingPositions = [
        ...(snapshot.pendingPositions ?? []).filter((fix) => fix.vehicleId !== position.vehicleId),
        position,
      ]
    })
  }
  async pendingPositions() {
    return (await this.repository.getSnapshot()).pendingPositions ?? []
  }
  async listNotices(outletId?: string) {
    return ((await this.repository.getSnapshot()).deliveryNotices ?? []).filter(
      (notice) => !outletId || notice.outletId === outletId,
    )
  }
  acknowledgeNotice(id: string) {
    return this.repository.update((snapshot) => {
      const notice = snapshot.deliveryNotices?.find((item) => item.id === id)
      if (!notice) throw new Error('Delivery alert was not found.')
      notice.readAt ??= new Date().toISOString()
    })
  }
  async checkDeliveryWindows(now: string) {
    const date = new Date(now)
    if (!Number.isFinite(date.getTime())) throw new Error('Use a valid delivery clock.')
    const snapshot = await this.repository.getSnapshot()
    if (!snapshot.settings.routeStarted) return
    const warnings = snapshot.stops
      .filter((stop) => !['Delivered', 'Cannot deliver'].includes(stop.status))
      .flatMap((stop) => {
        const window = deliveryWindow(stop, snapshot.orders, date)
        const state = window.overdue
          ? 'overdue'
          : window.etaLate
            ? 'etaLate'
            : window.dueSoon
              ? 'dueSoon'
              : undefined
        return state ? [{ stop, window, state }] : []
      })
    if (
      !warnings.some(
        ({ stop, state }) =>
          !snapshot.deliveryNotices?.some(
            (notice) =>
              notice.key === `${snapshot.settings.routeRevision}:${stop.id}:deadline:${state}`,
          ),
      )
    )
      return
    await this.repository.update((current) => {
      for (const { stop, window, state } of warnings) {
        const target = current.stops.find((item) => item.id === stop.id)
        if (
          !current.settings.routeStarted ||
          !target ||
          ['Delivered', 'Cannot deliver'].includes(target.status)
        )
          continue
        addDeliveryNotice(
          current,
          target,
          'deadline',
          state === 'overdue' ? 'Delivery window missed' : 'Delivery window at risk',
          `${window.fresh ? 'Fresh food must arrive by 08:00. ' : ''}${stop.outlet} · receive by ${window.deadline} · planned ETA ${stop.eta}. Contact the receiving manager about delays.`,
          state,
        )
      }
    })
  }
}
