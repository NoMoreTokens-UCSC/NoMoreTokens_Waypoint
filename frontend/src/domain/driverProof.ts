import type { Evidence, Order, QueuedAction, Stop } from './models'
import {
  managerSignOffErrors,
  signedManifestMatches,
  type ManagerSignOff,
} from './deliveryVerification'

export type ConnectivityStatus = 'online' | 'offline' | 'syncing'
export type ProofStatus = 'none' | 'captured' | 'localPending' | 'uploading' | 'accepted' | 'failed'
export type DeliveryStatus =
  'enRoute' | 'parked' | 'proofRequired' | 'pendingSync' | 'delivered' | 'issueReported'

/** A durable draft is a local photograph, never an upload acknowledgement. */
export interface DriverProofDraft {
  stopId: string
  photo: Blob
  fileName: string
  stage: 'captured' | 'attached'
  quantity: number
  receiver: string
  acknowledged: boolean
  exception: string
  revision: number
  createdAt: string
  signature?: Blob
  managerSignOff?: ManagerSignOff
  photoDigest?: string
}

export function proofStatus(
  evidence?: Evidence,
  record?: QueuedAction,
  draft?: DriverProofDraft,
  manifest?: { stop: Stop; orders: Order[] },
): ProofStatus {
  if (
    evidence?.kind === 'delivery' &&
    evidence.accepted &&
    !managerSignOffErrors(
      {
        stopId: evidence.entityId,
        quantity: evidence.quantity ?? NaN,
        receiver: evidence.receiver ?? '',
        exception: evidence.receiverException ?? '',
        fileName: evidence.fileName,
        revision: evidence.revision,
      },
      evidence.signature,
      evidence.managerSignOff,
    ).length &&
    (!manifest || signedManifestMatches(manifest.stop, manifest.orders, evidence.managerSignOff)) &&
    record?.status === 'accepted' &&
    record.evidenceId === evidence.id
  )
    return 'accepted'
  if (record?.status === 'syncing') return 'uploading'
  if (record?.status === 'retry') return 'failed'
  if (record || evidence) return 'localPending'
  return draft ? 'captured' : 'none'
}

export function deliveryStatus(stop: Stop, proof: ProofStatus): DeliveryStatus {
  // Even malformed/stale stop data cannot show Delivered without accepted proof.
  if (stop.status === 'Delivered' && proof === 'accepted') return 'delivered'
  if (stop.status === 'Cannot deliver') return 'issueReported'
  if (stop.status === 'Proof pending' || stop.status === 'Delivered') return 'pendingSync'
  if (stop.status === 'Arrived') return proof === 'none' ? 'parked' : 'proofRequired'
  return 'enRoute'
}

export function handoffErrors(draft: DriverProofDraft, expected: number): string[] {
  const errors: string[] = []
  if (!draft.photo.size) errors.push('A delivery photograph is required.')
  if (!Number.isInteger(draft.quantity) || draft.quantity < 0 || draft.quantity > expected)
    errors.push('Enter a whole case count between zero and the expected quantity.')
  if (draft.quantity !== expected && draft.exception.trim().length < 4)
    errors.push('Explain the quantity difference.')
  if (!draft.acknowledged) errors.push('The Store Manager must confirm unloading and receipt.')
  errors.push(...managerSignOffErrors(draft, draft.signature, draft.managerSignOff))
  return errors
}

export function attachPhoto(draft: DriverProofDraft): DriverProofDraft {
  if (!draft.photo.size) throw new Error('Capture a photograph before attaching proof.')
  return { ...draft, stage: 'attached' }
}
