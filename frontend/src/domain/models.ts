import type { DeliveryNotice, DevicePosition, WebPushRegistration } from './api/driverSignals'
import type { ManagerSignOff } from './deliveryVerification'

export type Workspace = 'dispatcher' | 'store-manager' | 'loader' | 'driver' | 'administration'
export type Temperature = 'Ambient' | 'Chilled'
export interface StoreOrderInput {
  temperature: Temperature
  cases: number
  weight: number
  volume: number
  window: string
  /** End of the receiving window, e.g. "07:30". Defaults to two hours after `window`. */
  windowEnd?: string
  /** Tech only: change this existing order instead of adding another (Tech orders as needed). */
  orderId?: string
}
export type OrderStatus =
  'Confirmed' | 'Allocated' | 'Deferred' | 'Scheduled' | 'En route' | 'Delivered'
export interface Order {
  id: string
  outlet: string
  outletName: string
  brand: 'Fresh' | 'Style' | 'Tech'
  window: string
  volume: number
  weight: number
  temperature: Temperature
  cases: number
  status: OrderStatus
  vehicleId?: string
  trip?: number
  deferralReason?: string
  priority: boolean
  /** The delivery day this order was for, "2026-09-24". Absent on the live orders (next run). */
  deliveryDate?: string
  /** Event times (ISO), set as the order moves through the workflow. */
  placedAt?: string
  scheduledAt?: string
  departedAt?: string
  deliveredAt?: string
  deferredAt?: string
  deferralAcknowledgedAt?: string
  receiptAt?: string
  /** Set when the store withdrew the order before the cutoff; such orders are kept in the history. */
  cancelledAt?: string
  windowEnd?: string
  receipt: 'Pending' | 'Confirmed' | 'Issue reported'
  issue?: string
  deferralAcknowledged?: boolean
  receiptReport?: {
    kind: 'Missing' | 'Damaged'
    received: number
    affected: number
    description: string
    recordedAt: string
  }
}
export interface Vehicle {
  id: string
  brand: Order['brand']
  /** False when the source does not tie vehicles to a brand (the backend), so any brand may use it. */
  brandRestricted?: boolean
  type: 'Van' | 'Truck'
  reefer: boolean
  weightCapacity: number
  volumeCapacity: number
  /** Ready: loaded and released, waiting for the driver to start. */
  status: 'Available' | 'Loading' | 'Ready' | 'En route' | 'Offline'
  location: string
  lat: number
  lng: number
  updatedMinutes: number
  positionSource?: 'device' | 'demo'
  positionUpdatedAt?: string
  positionAccuracy?: number
}
export interface Load {
  id: string
  vehicleId: string
  trip: number
  revision: number
  bay: string
  depot?: string
  departureTime?: string
  acknowledgedRevision?: number
  revisionChanges?: string[]
  issueDetails?: LoadIssueInput
  items: {
    outlet: string
    name: string
    expected: number
    loaded: number
    stop: number
    /** From the outlet's reference data, when the backend supplies it. */
    district?: string
    lat?: number
    lng?: number
    window?: string
    eta?: string
  }[]
  checks: { refrigeration: boolean; condition: boolean; restraints: boolean }
  issue?: string
  issueResolved: boolean
  photoId?: string
  completed: boolean
  released: boolean
}
export interface LoadIssueInput {
  kind: 'Missing' | 'Damaged'
  outlet: string
  affectedCases: number
  description: string
}
export interface Trip {
  id: string
  vehicleId: string
  number: number
  orderIds: string[]
  weight: number
  volume: number
  cases: number
  status: 'Planned' | 'Scheduled' | 'En route' | 'Complete'
}
export interface Stop {
  id: string
  loadId?: string
  outlet: string
  name: string
  address: string
  window: string
  eta: string
  originalEta?: string
  etaUpdatedAt?: string
  lat: number
  lng: number
  orderIds: string[]
  cases: number
  status: 'Upcoming' | 'Arrived' | 'Proof pending' | 'Delivered' | 'Cannot deliver'
  arrivedAt?: string
  proofId?: string
  issue?: string
}
export interface Evidence {
  id: string
  kind: 'loading' | 'delivery' | 'attempt' | 'profile'
  entityId: string
  photo: Blob
  fileName: string
  createdAt: string
  quantity?: number
  receiver?: string
  signature?: Blob
  managerSignOff?: ManagerSignOff
  receiverException?: string
  revision: number
  accepted: boolean
}
export type QueueStatus = 'pending' | 'syncing' | 'accepted' | 'review' | 'retry' | 'superseded'
export interface QueuedAction {
  id: string
  evidenceId: string
  stopId: string
  createdAt: string
  status: QueueStatus
  attempts: number
  message?: string
  revision: number
  kind: 'delivery' | 'attempt'
}
export interface TeamMember {
  id: string
  name: string
  email: string
  role: Workspace
  status: 'Active' | 'Invited' | 'Suspended'
  onRoute: boolean
  suspensionScheduled?: boolean
  mobile?: string
  depot?: string
  assignment?: string
  vehicleId?: string
  outletId?: string
  accessState?: 'Ready' | 'Invitation pending' | 'Recovery requested'
  invitationExpiresAt?: string
}
export interface MobileInvitation {
  name: string
  mobile: string
  role: Workspace
  depot: string
  assignment: string
}
export interface AuditEntry {
  id: string
  at: string
  action: string
  detail: string
  actor?: string
  recordId?: string
  recordName?: string
  referenceWhen?: string
}
export interface Settings {
  allocationReviewed?: boolean
  cutoffClosed: boolean
  published: boolean
  routeStarted: boolean
  routeStartedAt?: string
  routeRevision: number
  simulatedOffline: boolean
  syncOutcome: 'accepted' | 'review' | 'retry'
  profileName: string
  notificationsReadAt?: string
  profilePhotoId?: string
  profileLanguage?: string
  emergencyContact?: string
  profilePhone: string
  notifications: boolean
  compactRows: boolean
}
export interface Snapshot {
  routeEvents?: import('./routeHistory').RouteEvent[]
  pendingPushSubscriptions?: WebPushRegistration[]
  pendingPositions?: DevicePosition[]
  deliveryNotices?: DeliveryNotice[]
  orders: Order[]
  vehicles: Vehicle[]
  loads: Load[]
  stops: Stop[]
  members: TeamMember[]
  queue: QueuedAction[]
  audit: AuditEntry[]
  settings: Settings
  drafts: {
    id: string
    temperature: Temperature
    cases: number
    window: string
    weight?: number
    volume?: number
    windowEnd?: string
    /** The outlet that saved it; absent on drafts saved before outlets were tracked (OUT001). */
    outlet?: string
  }[]
  /** Earlier orders, kept apart from the live orders so planning screens are unaffected. */
  orderHistory?: Order[]
  orderHistoryVersion?: number
  unlistedTeamCounts?: { Active: number; Invited: number; Suspended: number }
  fleetReferenceVersion?: number
  designDataVersion?: number
  activeDriverId?: string
  /** Demo only: which outlet the store manager workspace is signed in as (default: the member's). */
  activeOutletId?: string
  unlistedAuditCount?: number
  auditReferenceVersion?: number
}
