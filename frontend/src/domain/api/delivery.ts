import type { Evidence, QueuedAction, Stop } from '../models'
import type { DriverProofDraft } from '../driverProof'
import type { ManagerSignOff } from '../deliveryVerification'
import type { RouteEvent } from '../routeHistory'

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
  managerSignOff?: ManagerSignOff
  /** Capture revision is retained when submission follows a route change. */
  capturedRevision?: number
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
  confirmManagerHandoff(outletId: string, stopId: string, proof: DeliveryProof): Promise<void>
  reportIssue(stopId: string, issue: string): Promise<void>
  reportDelay(
    stopId: string,
    note: string,
    revisedEta?: string,
    kind?: 'delay' | 'breakdown',
  ): Promise<void>
  listRouteHistory(): Promise<RouteEvent[]>
  saveAttemptProof(stopId: string, photo: File, issue: string): Promise<void>
  retryStop(stopId: string): Promise<void>
  reopenProofForSignOff(actionId: string): Promise<void>
  getEvidence(evidenceId: string): Promise<Evidence | undefined>
  getProofDraft(stopId: string): Promise<DriverProofDraft | undefined>
  listProofDrafts(): Promise<DriverProofDraft[]>
  saveProofDraft(draft: DriverProofDraft): Promise<void>
  deleteProofDraft(stopId: string): Promise<void>
  /** Records saved on this device that still need, or are under, sync review. */
  listQueue(): Promise<QueuedAction[]>
  sync(isOnline: boolean, options?: { retryFailed?: boolean }): Promise<void>
  reviewQueuedRecord(actionId: string): Promise<void>
}
