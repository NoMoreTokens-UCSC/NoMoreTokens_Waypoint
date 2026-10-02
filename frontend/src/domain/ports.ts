import type { Evidence, QueuedAction, Snapshot } from './models'

export interface OperationsRepository {
  getSnapshot(): Promise<Snapshot>
  update(change: (snapshot: Snapshot) => void): Promise<void>
  getEvidence(id: string): Promise<Evidence | undefined>
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
