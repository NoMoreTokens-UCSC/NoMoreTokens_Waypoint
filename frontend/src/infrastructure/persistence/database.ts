import Dexie, { type Table } from 'dexie'
import type { Evidence, QueuedAction, Snapshot } from '../../domain/models'

export class WaypointDatabase extends Dexie {
  snapshots!: Table<{ id: string; data: Omit<Snapshot, 'queue'> }, string>
  evidence!: Table<Evidence, string>
  queue!: Table<QueuedAction, string>
  constructor(name = 'waypoint-operations-v1') {
    super(name)
    this.version(1).stores({
      snapshots: 'id',
      evidence: 'id,kind,entityId',
      queue: 'id,status,createdAt,evidenceId',
    })
  }
}
