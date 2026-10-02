import type { Evidence, QueuedAction, Stop } from '../models'

export interface RouteState {
  started: boolean
  revision: number
  stops: Stop[]
}
export interface DeliveryProof {
  photo: File
  quantity: number
  receiver: string
  exception: string
  signature?: Blob
}

/**
 * The driver's route and proof of delivery. Proof is saved on the device first and
 * synced later, so it keeps working without a connection.
 */
export interface DeliveryApi {
  getRoute(): Promise<RouteState>
  listStops(filter?: { outletId?: string }): Promise<Stop[]>
  startRoute(): Promise<void>
  arrive(stopId: string): Promise<void>
  saveProof(stopId: string, proof: DeliveryProof): Promise<void>
  reportIssue(stopId: string, issue: string): Promise<void>
  saveAttemptProof(stopId: string, photo: File, issue: string): Promise<void>
  retryStop(stopId: string): Promise<void>
  getEvidence(evidenceId: string): Promise<Evidence | undefined>
  /** Records saved on this device that still need, or are under, sync review. */
  listQueue(): Promise<QueuedAction[]>
  sync(isOnline: boolean): Promise<void>
  reviewQueuedRecord(actionId: string): Promise<void>
}
