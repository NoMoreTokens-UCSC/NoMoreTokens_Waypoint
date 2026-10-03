export interface DevicePosition {
  vehicleId: string
  lat: number
  lng: number
  accuracy: number
  recordedAt: string
}
export interface DeliveryNotice {
  id: string
  key: string
  stopId: string
  outletId: string
  kind: 'enRoute' | 'arrival' | 'delay' | 'issue' | 'completed' | 'deadline'
  title: string
  message: string
  createdAt: string
  readAt?: string
  /** Local adapter never claims cross-device delivery. */
  delivery: 'local' | 'queued' | 'sent'
}
export interface WebPushRegistration {
  outletId: string
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
  createdAt: string
}
/** Replace the local adapter with authenticated HTTP/realtime transport. */
export interface DriverSignalsApi {
  registerPushSubscription(subscription: WebPushRegistration): Promise<void>
  recordPosition(position: DevicePosition): Promise<void>
  pendingPositions(): Promise<DevicePosition[]>
  listNotices(outletId?: string): Promise<DeliveryNotice[]>
  acknowledgeNotice(id: string): Promise<void>
  checkDeliveryWindows(now: string): Promise<void>
}
