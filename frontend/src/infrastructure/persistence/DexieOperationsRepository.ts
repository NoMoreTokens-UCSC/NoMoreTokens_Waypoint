import { sourceFleet } from '../demo/fleetReference'
import type { OperationsRepository } from '../../domain/ports'
import type { Evidence, QueuedAction, Snapshot } from '../../domain/models'
import type { DriverProofDraft } from '../../domain/driverProof'
import { createSeed } from '../demo/seed'
import { WaypointDatabase } from './database'
import { sourceTeam, unlistedTeamCounts } from '../demo/teamReference'
import { sourceAudit } from '../demo/auditReference'
import { outletOrderHistory } from '../demo/orderHistory'

export class DexieOperationsRepository implements OperationsRepository {
  private ready: Promise<void> | undefined
  constructor(private db: WaypointDatabase) {}
  private initialize() {
    this.ready ??= this.db.transaction('rw', this.db.snapshots, this.db.queue, async () => {
      if (!(await this.db.snapshots.get('workspace'))) {
        const { queue, ...data } = createSeed()
        await this.db.snapshots.put({ id: 'workspace', data })
        if (queue.length) await this.db.queue.bulkPut(queue)
      }
      const record = await this.db.snapshots.get('workspace')
      if (record) {
        const templates = createSeed().loads
        let changed = false
        for (const load of record.data.loads) {
          const template = templates.find((entry) => entry.id === load.id)
          if (!load.depot && template?.depot) {
            load.depot = template.depot
            changed = true
          }
          if (!load.departureTime && template?.departureTime) {
            load.departureTime = template.departureTime
            changed = true
          }
        }
        if (changed) await this.db.snapshots.put(record)
      }
      if (record && !record.data.designDataVersion) {
        // Preserve uploads, queue records, route progress and custom invitations.
        for (const reference of sourceTeam) {
          const member = record.data.members.find((member) => member.id === reference.id)
          if (member) {
            const state = {
              status: member.status,
              onRoute: member.onRoute,
              suspensionScheduled: member.suspensionScheduled,
            }
            Object.assign(member, reference, state)
          } else record.data.members.push({ ...reference })
        }
        record.data.unlistedTeamCounts = { ...unlistedTeamCounts }
        record.data.designDataVersion = 1
        await this.db.snapshots.put(record)
      }
      if (record && !record.data.auditReferenceVersion) {
        record.data.audit = [
          ...record.data.audit.filter((entry) => entry.id !== 'AUD001'),
          ...sourceAudit.map((entry) => ({ ...entry })),
        ]
        record.data.unlistedAuditCount = 207
        record.data.auditReferenceVersion = 1
        await this.db.snapshots.put(record)
      }
      if (record && !record.data.fleetReferenceVersion) {
        const featured = record.data.vehicles.find((vehicle) => vehicle.id === 'VEH055')
        record.data.vehicles = sourceFleet.map((vehicle) => ({ ...vehicle }))
        if (record.data.settings.published && featured) {
          const vehicle = record.data.vehicles.find((vehicle) => vehicle.id === 'VEH055')!
          vehicle.status = featured.status
        }
        record.data.fleetReferenceVersion = 1
        await this.db.snapshots.put(record)
      }
      if (record && !record.data.orderHistoryVersion) {
        // Browsers that stored data before order history existed receive the sample history.
        record.data.orderHistory = outletOrderHistory.map((order) => ({ ...order }))
        record.data.orderHistoryVersion = 1
        await this.db.snapshots.put(record)
      }
      if (record && !record.data.teamDetailVersion) {
        // Browsers that stored the team before it had last-active and join details receive them.
        for (const reference of sourceTeam) {
          const member = record.data.members.find((candidate) => candidate.id === reference.id)
          if (member) {
            member.lastActive ??= reference.lastActive
            member.username ??= reference.username
            member.joined ??= reference.joined
            member.lastSeen ??= reference.lastSeen
          }
        }
        record.data.teamDetailVersion = 1
        await this.db.snapshots.put(record)
      }
      // Interrupted uploads remain recoverable after a tab closes.
      await this.db.queue
        .where('status')
        .equals('syncing')
        .modify({ status: 'retry', message: 'Sync interrupted. Your evidence is retained.' })
    })
    return this.ready
  }
  async getSnapshot(): Promise<Snapshot> {
    await this.initialize()
    return this.db.transaction('r', this.db.snapshots, this.db.queue, async () => {
      const record = await this.db.snapshots.get('workspace')
      if (!record) throw new Error('Workspace data could not be loaded.')
      return { ...record.data, queue: await this.db.queue.toArray() }
    })
  }
  private async mutate(change: (snapshot: Snapshot) => void) {
    const record = await this.db.snapshots.get('workspace')
    if (!record) throw new Error('Workspace data is missing.')
    const snapshot: Snapshot = { ...record.data, queue: await this.db.queue.toArray() }
    change(snapshot)
    const { queue, ...data } = snapshot
    await this.db.snapshots.put({ id: 'workspace', data })
    if (queue.length) await this.db.queue.bulkPut(queue)
  }
  async update(change: (snapshot: Snapshot) => void) {
    await this.initialize()
    await this.db.transaction('rw', this.db.snapshots, this.db.queue, () => this.mutate(change))
  }
  async getEvidence(id: string) {
    await this.initialize()
    return this.db.evidence.get(id)
  }
  async getProofDraft(stopId: string) {
    await this.initialize()
    return this.db.driverProofDrafts.get(stopId)
  }
  async listProofDrafts() {
    await this.initialize()
    return this.db.driverProofDrafts.toArray()
  }
  async saveProofDraft(draft: DriverProofDraft) {
    await this.initialize()
    await this.db.driverProofDrafts.put(draft)
  }
  async deleteProofDraft(stopId: string) {
    await this.initialize()
    await this.db.driverProofDrafts.delete(stopId)
  }
  async restoreProofDraft(
    actionId: string,
    draft: DriverProofDraft,
    change: (snapshot: Snapshot) => void,
  ) {
    await this.initialize()
    await this.db.transaction(
      'rw',
      this.db.snapshots,
      this.db.queue,
      this.db.driverProofDrafts,
      async () => {
        const action = await this.db.queue.get(actionId)
        if (!action || action.status === 'syncing' || action.status === 'superseded')
          throw new Error('This record cannot be reopened.')
        await this.db.queue.update(actionId, {
          status: 'superseded',
          message:
            'Retained historical proof. Manager sign-off must be completed on the replacement.',
        })
        await this.mutate(change)
        await this.db.driverProofDrafts.put(draft)
      },
    )
  }
  async saveEvidence(
    evidence: Evidence,
    action: QueuedAction | undefined,
    change: (snapshot: Snapshot) => void,
  ) {
    await this.initialize()
    await this.db.transaction(
      'rw',
      this.db.snapshots,
      this.db.queue,
      this.db.evidence,
      this.db.driverProofDrafts,
      async () => {
        await this.db.evidence.put(evidence)
        if (action) await this.db.queue.put(action)
        await this.mutate(change)
        if (evidence.kind === 'delivery') await this.db.driverProofDrafts.delete(evidence.entityId)
      },
    )
  }
  async settleAction(
    actionId: string,
    status: 'accepted' | 'review' | 'retry',
    message: string,
    change: (snapshot: Snapshot) => void,
  ) {
    await this.initialize()
    await this.db.transaction(
      'rw',
      this.db.snapshots,
      this.db.queue,
      this.db.evidence,
      async () => {
        const action = await this.db.queue.get(actionId)
        if (!action) throw new Error('Queued record was not found.')
        await this.db.queue.update(actionId, { status, message })
        if (status === 'accepted')
          await this.db.evidence.update(action.evidenceId, { accepted: true })
        await this.mutate(change)
      },
    )
  }
  async reset() {
    await this.db.transaction(
      'rw',
      this.db.snapshots,
      this.db.queue,
      this.db.evidence,
      this.db.driverProofDrafts,
      async () => {
        await this.db.snapshots.clear()
        await this.db.queue.clear()
        await this.db.evidence.clear()
        await this.db.driverProofDrafts.clear()
        const { queue: _queue, ...data } = createSeed()
        void _queue
        await this.db.snapshots.put({ id: 'workspace', data })
      },
    )
  }
}
