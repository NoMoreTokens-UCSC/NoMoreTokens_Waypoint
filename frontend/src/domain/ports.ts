import type { Evidence, QueuedAction, Snapshot } from './models'
import type { DriverProofDraft } from './driverProof'

export interface OperationsRepository {
  getSnapshot(): Promise<Snapshot>
  update(change: (snapshot: Snapshot) => void): Promise<void>
  getEvidence(id: string): Promise<Evidence | undefined>
  getProofDraft(stopId: string): Promise<DriverProofDraft | undefined>
  listProofDrafts(): Promise<DriverProofDraft[]>
  saveProofDraft(draft: DriverProofDraft): Promise<void>
  deleteProofDraft(stopId: string): Promise<void>
  restoreProofDraft(
    actionId: string,
    draft: DriverProofDraft,
    change: (snapshot: Snapshot) => void,
  ): Promise<void>
  saveEvidence(
    evidence: Evidence,
    action: QueuedAction | undefined,
    change: (snapshot: Snapshot) => void,
  ): Promise<void>
  settleAction(
    actionId: string,
    status: 'accepted' | 'review' | 'retry',
    message: string,
    change: (snapshot: Snapshot) => void,
  ): Promise<void>
  reset(): Promise<void>
}
export interface SyncGateway {
  submit(
    action: QueuedAction,
    evidence: Evidence,
    outcome: 'accepted' | 'review' | 'retry',
  ): Promise<{ status: 'accepted' | 'review' | 'retry'; message: string }>
}
