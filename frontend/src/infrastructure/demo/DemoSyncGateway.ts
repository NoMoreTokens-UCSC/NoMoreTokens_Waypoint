import type { SyncGateway } from '../../domain/ports'
import type { Evidence, QueuedAction } from '../../domain/models'

/** Explicit frontend simulation. Replace this adapter with the future authenticated API. */
export class DemoSyncGateway implements SyncGateway {
  async submit(
    _action: QueuedAction,
    evidence: Evidence,
    outcome: 'accepted' | 'review' | 'retry',
  ) {
    if (!evidence.photo.size) throw new Error('The saved photograph is empty.')
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      status: outcome,
      message:
        outcome === 'accepted'
          ? 'Accepted by the demo sync adapter.'
          : outcome === 'review'
            ? 'The route changed. Review the revised instructions before retrying.'
            : 'Upload interrupted. The photograph and record remain on this device.',
    }
  }
}
