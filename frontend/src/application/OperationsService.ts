import type { OperationsRepository, SyncGateway } from '../domain/ports'
import type {
  Evidence,
  Load,
  LoadIssueInput,
  MobileInvitation,
  QueuedAction,
  Settings,
  Snapshot,
  TeamMember,
  Order,
  StoreOrderInput,
  Workspace,
} from '../domain/models'
import { allocationErrors, departureErrors, loadErrors, publicationErrors } from '../domain/rules'
import type { DriverProofDraft } from '../domain/driverProof'
import {
  managerSignOffErrors,
  signedManifestMatches,
  type ManagerSignOff,
} from '../domain/deliveryVerification'
import { clockMinutes, freshWindowErrors, receivingWindowEnd } from '../domain/deliveryWindow'
import { photoDigest } from '../domain/photoDigest'
import { addDeliveryNotice } from './DriverSignalsService'
import { assignedDriverLoad, driverDepartureErrors, isAssignedStop } from '../domain/driverWorkflow'
import { recordRouteEvent } from '../domain/routeHistory'
import type { DeliveryProof } from '../domain/api/delivery'

const id = () => crypto.randomUUID()
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function log(s: Snapshot, action: string, detail: string) {
  const member = s.members.find((member) => detail.includes(member.name))
  s.audit.unshift({
    id: id(),
    at: new Date().toISOString(),
    action,
    detail,
    actor: 'Administrator',
    recordId: member?.id,
    recordName: member?.name,
  })
}
const requireLoad = (s: Snapshot, loadId: string) => {
  const load = s.loads.find((l) => l.id === loadId)
  if (!load) throw new Error('Load was not found.')
  return load
}
function checkPhoto(file: Blob) {
  assert(file.size > 0 && file.size <= 10 * 1024 * 1024, 'Choose a photograph smaller than 10 MB.')
  assert(/^image\/(jpeg|png|webp)$/.test(file.type), 'Use a JPEG, PNG, or WebP photograph.')
}

export class OperationsService {
  private syncing = false
  constructor(
    public readonly repository: OperationsRepository,
    private gateway: SyncGateway,
  ) {}
  allocate(orderId: string, vehicleId: string, trip: number) {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'The plan is published. Allocation is locked.')
      const order = s.orders.find((o) => o.id === orderId),
        vehicle = s.vehicles.find((v) => v.id === vehicleId)
      assert(order && vehicle, 'Select a valid order and vehicle.')
      const errors = allocationErrors(order, vehicle, trip, s.orders)
      assert(!errors.length, errors.join(' '))
      Object.assign(order, { vehicleId, trip, status: 'Allocated', deferralReason: undefined })
      s.settings.allocationReviewed = false
      log(s, 'Order allocated', `${order.id} → ${vehicleId} · Trip ${trip}`)
    })
  }
  unallocate(orderId: string) {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'The published plan is locked.')
      const order = s.orders.find((order) => order.id === orderId)
      assert(order, 'Order was not found.')
      Object.assign(order, {
        status: 'Confirmed',
        vehicleId: undefined,
        trip: undefined,
        deferralReason: undefined,
      })
      s.settings.allocationReviewed = false
      log(s, 'Allocation removed', order.id)
    })
  }
  autoAllocate() {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'The published plan is locked.')
      s.settings.allocationReviewed = false
      const pending = s.orders
        .filter((o) => o.status === 'Confirmed')
        .sort((a, b) => Number(b.priority) - Number(a.priority))
      for (const order of pending) {
        const candidates = [...s.vehicles].sort((a, b) => {
          const featured = ['ORD1042', 'ORD1072'].includes(order.id)
          return (
            (featured ? Number(b.id === 'VEH055') - Number(a.id === 'VEH055') : 0) ||
            a.id.localeCompare(b.id)
          )
        })
        let allocated = false
        for (const trip of [1, 2]) {
          const vehicle = candidates.find((v) => !allocationErrors(order, v, trip, s.orders).length)
          if (vehicle) {
            Object.assign(order, { vehicleId: vehicle.id, trip, status: 'Allocated' })
            allocated = true
            break
          }
        }
        if (!allocated)
          Object.assign(order, {
            status: 'Deferred',
            deferralReason: undefined,
            deferredAt: new Date().toISOString(),
          })
      }
      log(
        s,
        'Demo allocation proposed',
        `${s.orders.filter((o) => o.status === 'Allocated').length} orders allocated; review before publication`,
      )
    })
  }
  defer(orderId: string, reason: string) {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'The published plan is locked.')
      const order = s.orders.find((o) => o.id === orderId)
      assert(order, 'Order was not found.')
      assert(
        !order.priority,
        'This outlet was previously skipped. Restore its priority allocation.',
      )
      assert(reason.trim().length > 2, 'Select a deferral reason.')
      Object.assign(order, {
        status: 'Deferred',
        deferralReason: reason,
        deferredAt: new Date().toISOString(),
        vehicleId: undefined,
        trip: undefined,
      })
      s.settings.allocationReviewed = false
      log(s, 'Deferral recorded', `${order.id} · ${reason}`)
    })
  }
  reviewAllocation() {
    return this.repository.update((s) => {
      const errors = publicationErrors(s)
      assert(!errors.length, errors[0] ?? 'Review the plan.')
      s.settings.allocationReviewed = true
      log(
        s,
        'Allocation review completed',
        'Capacity, temperature, trip limits and deferrals checked',
      )
    })
  }
  publish() {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'This plan is already published.')
      const errors = publicationErrors(s)
      assert(!errors.length, errors[0] ?? 'Review the plan.')
      assert(s.settings.allocationReviewed, 'Complete the allocation review before publishing.')
      s.settings.published = true
      const scheduledAt = new Date().toISOString()
      s.orders.forEach((o) => {
        if (o.status === 'Allocated') Object.assign(o, { status: 'Scheduled', scheduledAt })
      })
      const previousLoads = s.loads
      const previousStops = s.stops
      const scheduled = s.orders.filter((order) => order.status === 'Scheduled')
      const keys = [...new Set(scheduled.map((order) => `${order.vehicleId}:${order.trip}`))]
      // Keep existing record identities and the featured driver route first.
      keys.sort((a, b) => {
        const rank = (key: string) =>
          previousLoads.findIndex((load) => `${load.vehicleId}:${load.trip}` === key)
        return (
          (rank(a) < 0 ? Infinity : rank(a)) - (rank(b) < 0 ? Infinity : rank(b)) ||
          a.localeCompare(b)
        )
      })
      s.loads = []
      s.stops = []
      for (const key of keys) {
        const assigned = scheduled.filter((order) => `${order.vehicleId}:${order.trip}` === key)
        const { vehicleId, trip } = assigned[0]
        assert(vehicleId && trip, 'Published orders need a vehicle and trip.')
        const existing = previousLoads.find(
          (load) => load.vehicleId === vehicleId && load.trip === trip,
        )
        const loadId = existing?.id ?? `LOAD${vehicleId.slice(3)}-${trip}`
        const outlets = [...new Set(assigned.map((order) => order.outlet))].sort((a, b) => {
          const earliest = (outlet: string) =>
            assigned
              .filter((order) => order.outlet === outlet)
              .map((order) => order.window)
              .sort()[0]
          return earliest(a).localeCompare(earliest(b)) || a.localeCompare(b)
        })
        const stops = outlets.map((outlet, index) => {
          const orders = assigned.filter((order) => order.outlet === outlet)
          const old = previousStops.find((stop) => stop.outlet === outlet)
          const windowStart = orders.map((order) => order.window).sort()[0]
          const baseId = `STOP${outlet.slice(3)}`
          return {
            id: s.stops.some((stop) => stop.id === baseId) ? `${baseId}-${loadId}` : baseId,
            loadId,
            outlet,
            name: orders[0].outletName,
            address: old?.address ?? `${outlet} receiving bay · demo location`,
            window: `${windowStart}–${orders
              .map((order) => receivingWindowEnd(order.window, order.windowEnd, order.brand === 'Fresh'))
              .sort()[0]}`,
            eta: old?.eta ?? windowStart,
            lat: old?.lat ?? 6.95 + index * 0.008,
            lng: old?.lng ?? 79.9 + index * 0.006,
            orderIds: orders.map((order) => order.id),
            cases: orders.reduce((n, order) => n + order.cases, 0),
            status: 'Upcoming' as const,
          }
        })
        const revision = existing?.revision ?? s.settings.routeRevision
        s.loads.push({
          id: loadId,
          vehicleId,
          trip,
          revision,
          depot:
            existing?.depot ??
            s.members.find((member) => member.vehicleId === vehicleId)?.depot ??
            s.members.find((member) => member.role === 'dispatcher')?.depot,
          departureTime:
            existing?.departureTime ??
            previousLoads.find((load) => load.departureTime)?.departureTime,
          bay: existing?.bay ?? 'Unassigned',
          acknowledgedRevision: revision,
          items: [...stops].reverse().map((stop) => ({
            outlet: stop.outlet,
            name: stop.name,
            expected: stop.cases,
            loaded: 0,
            stop: stops.indexOf(stop) + 1,
          })),
          checks: { refrigeration: false, condition: false, restraints: false },
          issueResolved: true,
          completed: false,
          released: false,
        })
        s.stops.push(...stops)
      }
      log(
        s,
        'Plan published',
        'Reviewed allocations shared with loading; departure still requires proof',
      )
    })
  }
  private assertLoadingWritable(s: Snapshot, load: Load, expectedRevision?: number) {
    assert(s.settings.published, 'Publish the reviewed plan before loading.')
    assert(!load.released, 'This vehicle has departed. Loading is locked.')
    assert(
      expectedRevision === undefined || expectedRevision === load.revision,
      'Loading instructions changed. Refresh and review the revision.',
    )
    assert(
      load.acknowledgedRevision === undefined || load.acknowledgedRevision === load.revision,
      'Review and acknowledge the revised loading instructions.',
    )
  }
  acknowledgeLoadRevision(loadId: string, expectedRevision: number) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId)
      assert(
        s.settings.published && !load.released,
        'Only published, unreleased loads can be reviewed.',
      )
      assert(
        load.revision === expectedRevision,
        'Loading instructions changed. Refresh and review the revision.',
      )
      assert(load.issueResolved, 'Await the Dispatcher decision before reviewing a revision.')
      load.acknowledgedRevision = expectedRevision
      log(s, 'Loading revision acknowledged', `${load.id} · Revision ${expectedRevision}`)
    })
  }
  editLoad(loadId: string, update: (load: Load) => void, expectedRevision?: number) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId)
      this.assertLoadingWritable(s, load, expectedRevision)
      update(load)
      if (loadErrors(load, false).length) {
        load.photoId = undefined
        load.completed = false
      }
    })
  }
  setLoaded(loadId: string, outlet: string, quantity: number, expectedRevision?: number) {
    return this.editLoad(
      loadId,
      (load) => {
        const item = load.items.find((i) => i.outlet === outlet)
        assert(
          item && Number.isInteger(quantity) && quantity >= 0 && quantity <= item.expected,
          'Enter a valid case count.',
        )
        item.loaded = quantity
      },
      expectedRevision,
    )
  }
  setCheck(loadId: string, key: keyof Load['checks'], checked: boolean, expectedRevision?: number) {
    return this.editLoad(
      loadId,
      (load) => {
        assert(
          ['refrigeration', 'condition', 'restraints'].includes(key),
          'Select a valid safety check.',
        )
        load.checks[key] = checked
      },
      expectedRevision,
    )
  }
  reportLoadIssue(loadId: string, issue: string | LoadIssueInput, expectedRevision?: number) {
    return this.editLoad(
      loadId,
      (load) => {
        assert(load.issueResolved, 'A shortfall is already awaiting a Dispatcher decision.')
        if (typeof issue !== 'string') {
          const item = load.items.find((item) => item.outlet === issue.outlet)
          assert(
            item &&
              ['Missing', 'Damaged'].includes(issue.kind) &&
              Number.isInteger(issue.affectedCases) &&
              issue.affectedCases > 0 &&
              issue.affectedCases <= item.expected,
            'Select a stop and valid affected case count.',
          )
          assert(issue.description.trim().length > 3, 'Describe the missing or damaged goods.')
          load.issueDetails = { ...issue, description: issue.description.trim() }
          load.issue = `${issue.outlet} · ${issue.kind} · ${issue.affectedCases} cases · ${issue.description.trim()}`
        } else {
          assert(issue.trim().length > 3, 'Describe the missing or damaged goods.')
          load.issue = issue.trim()
          load.issueDetails = undefined
        }
        load.issueResolved = false
        load.completed = false
      },
      expectedRevision,
    )
  }
  resolveLoadIssue(loadId: string) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId)
      assert(s.settings.published, 'Publish the reviewed plan first.')
      assert(!load.released, 'Loading has already been released.')
      assert(load.issue && !load.issueResolved, 'No unresolved shortfall needs a decision.')
      load.acknowledgedRevision = load.revision
      load.issueResolved = true
      load.revision += 1
      load.revisionChanges = [
        `Replacement approved for: ${load.issue}`,
        'Reconcile case counts, repeat safety checks and attach a new photograph.',
      ]
      load.items.forEach((item) => {
        item.loaded = 0
      })
      load.photoId = undefined
      load.completed = false
      load.checks = { refrigeration: false, condition: false, restraints: false }
      const driver = s.members.find((member) => member.id === (s.activeDriverId ?? 'USR001'))
      if (driver?.vehicleId === load.vehicleId && load.trip === 1)
        s.settings.routeRevision = load.revision
      log(
        s,
        'Demo manifest revised',
        `${load.vehicleId} · Revision ${load.revision}; recheck quantities and attach fresh proof`,
      )
    })
  }
  async attachLoadingPhoto(loadId: string, file: File, expectedRevision?: number) {
    checkPhoto(file)
    const s = await this.repository.getSnapshot(),
      load = requireLoad(s, loadId)
    this.assertLoadingWritable(s, load, expectedRevision)
    assert(
      !loadErrors(load, false).length && !load.released,
      'Finish the case counts and safety checks before attaching proof.',
    )
    const evidence: Evidence = {
      id: id(),
      kind: 'loading',
      entityId: loadId,
      photo: file,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      revision: load.revision,
      accepted: false,
    }
    await this.repository.saveEvidence(evidence, undefined, (current) => {
      const target = requireLoad(current, loadId)
      this.assertLoadingWritable(current, target, expectedRevision)
      assert(
        target.revision === evidence.revision &&
          !loadErrors(target, false).length &&
          !target.released,
        'Loading changed while the photograph was being saved. Review the load again.',
      )
      target.photoId = evidence.id
      target.completed = false
      log(current, 'Loading photograph saved', `${target.vehicleId} · Revision ${target.revision}`)
    })
  }
  async completeLoading(loadId: string, expectedRevision?: number) {
    const snapshot = await this.repository.getSnapshot()
    const previous = requireLoad(snapshot, loadId)
    this.assertLoadingWritable(snapshot, previous, expectedRevision)
    const previousErrors = loadErrors(previous)
    assert(!previousErrors.length, previousErrors[0] ?? 'Loading is incomplete.')
    const evidence = await this.repository.getEvidence(previous.photoId!)
    assert(
      evidence?.kind === 'loading' &&
        evidence.entityId === loadId &&
        evidence.revision === previous.revision,
      'Loading proof is missing or outdated. Attach a fresh photograph.',
    )
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId),
        errors = loadErrors(load)
      this.assertLoadingWritable(s, load, expectedRevision)
      assert(
        load.photoId === previous.photoId && load.revision === previous.revision,
        'Loading changed while completion was being saved. Review the load again.',
      )
      assert(!errors.length, errors[0] ?? 'Loading is incomplete.')
      load.completed = true
      if (load.id === assignedDriverLoad(s)?.id)
        recordRouteEvent(
          s,
          'loaderConfirmed',
          'Loader confirmed quantities, safety checks and loading photograph.',
        )
      log(
        s,
        'Loading complete',
        `${load.vehicleId} · ${load.items.reduce((n, i) => n + i.expected, 0)} cases and proof checked`,
      )
    })
  }
  release(loadId: string) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId),
        errors = departureErrors(s, load)
      assert(!errors.length, errors[0] ?? 'Vehicle is not ready.')
      load.released = true
      const vehicle = s.vehicles.find((v) => v.id === load.vehicleId)
      if (vehicle) vehicle.status = 'En route'
      s.orders
        .filter((o) => o.vehicleId === load.vehicleId && o.trip === load.trip)
        .forEach((o) => {
          Object.assign(o, { status: 'En route', departedAt: new Date().toISOString() })
        })
      if (load.id === assignedDriverLoad(s)?.id)
        recordRouteEvent(s, 'released', 'Dispatcher released the confirmed truck.')
      log(s, 'Demo departure released', `${load.vehicleId} · Trip ${load.trip}`)
    })
  }
  startRoute() {
    return this.repository.update((s) => {
      assert(!s.settings.routeStarted, 'This route has already started.')
      const errors = driverDepartureErrors(s)
      assert(!errors.length, errors.join(' '))
      const load = assignedDriverLoad(s)
      assert(load, 'An assigned driver load is required before departure.')
      assert(
        load.released,
        'The Dispatcher must release the vehicle after loading proof is complete.',
      )
      const driver = s.members.find((m) => m.id === (s.activeDriverId ?? 'USR001'))
      assert(
        driver?.status === 'Active' && driver.role === 'driver',
        'An active assigned driver is required before departure.',
      )
      s.settings.routeStarted = true
      s.settings.routeStartedAt = new Date().toISOString()
      driver.onRoute = true
      for (const stop of s.stops.filter(
        (item) => isAssignedStop(item, s.orders, load) && item.status === 'Upcoming',
      ))
        addDeliveryNotice(
          s,
          stop,
          'enRoute',
          'Your delivery is on the way',
          `${stop.outlet} · planned ETA ${stop.eta} · receiving window ${stop.window}.`,
        )
      recordRouteEvent(s, 'started', `${driver.name} · ${load.vehicleId} · Trip ${load.trip}`)
      log(s, 'Demo route started', `${driver.name} · ${load.vehicleId} · Trip ${load.trip}`)
    })
  }
  arrive(stopId: string) {
    return this.repository.update((s) => {
      assert(s.settings.routeStarted, 'Check and start your route first.')
      const stop = s.stops.find((v) => v.id === stopId)
      assert(
        stop && isAssignedStop(stop, s.orders, assignedDriverLoad(s)),
        'This outlet is not assigned to your truck.',
      )
      assert(stop.status === 'Upcoming', 'This stop is already in progress or complete.')
      assert(
        !s.stops.some((item) => item.id !== stopId && item.status === 'Arrived'),
        'Complete the handoff at your current outlet before recording another arrival.',
      )
      stop.status = 'Arrived'
      stop.arrivedAt = new Date().toISOString()
      addDeliveryNotice(
        s,
        stop,
        'arrival',
        'Driver has arrived',
        'Please check unloaded quantities, add remarks and confirm in Deliveries. If data is unavailable, sign on the driver’s device.',
      )
      recordRouteEvent(s, 'arrived', 'Driver confirmed arrival and safe parking.', stop)
      log(s, 'Arrived at outlet', stop.outlet)
    })
  }
  async saveProofDraft(draft: DriverProofDraft) {
    checkPhoto(draft.photo)
    const current = await this.repository.getSnapshot()
    const stop = current.stops.find((item) => item.id === draft.stopId)
    assert(
      current.settings.routeStarted &&
        stop?.status === 'Arrived' &&
        isAssignedStop(stop, current.orders, assignedDriverLoad(current)),
      'Park at the stop before capturing proof.',
    )
    assert(
      !current.queue.some(
        (record) =>
          record.stopId === draft.stopId && !['accepted', 'superseded'].includes(record.status),
      ),
      'Proof is already waiting for this stop.',
    )
    await this.repository.saveProofDraft(draft)
  }
  async confirmManagerHandoff(outletId: string, stopId: string, proof: DeliveryProof) {
    const snapshot = await this.repository.getSnapshot()
    const stop = snapshot.stops.find((item) => item.id === stopId)
    assert(
      stop?.outlet === outletId &&
        snapshot.members.some(
          (member) =>
            member.role === 'store-manager' &&
            member.status === 'Active' &&
            member.outletId === outletId,
        ),
      'This handoff is not assigned to your outlet.',
    )
    await this.saveDeliveryProof(
      stopId,
      proof.photo,
      proof.quantity,
      proof.receiver,
      proof.exception,
      proof.signature,
      proof.capturedRevision,
      proof.managerSignOff,
    )
  }
  async saveDeliveryProof(
    stopId: string,
    file: File,
    quantity: number,
    receiver: string,
    exception: string,
    signature?: Blob,
    capturedRevision?: number,
    managerSignOff?: ManagerSignOff,
  ) {
    checkPhoto(file)
    if (signature) checkPhoto(signature)
    const s = await this.repository.getSnapshot(),
      stop = s.stops.find((v) => v.id === stopId)
    assert(
      s.settings.routeStarted &&
        stop &&
        isAssignedStop(stop, s.orders, assignedDriverLoad(s)) &&
        ['Arrived', 'Proof pending'].includes(stop.status),
      'Arrive at this stop before recording proof.',
    )
    assert(
      !s.queue.some((q) => q.stopId === stopId && !['accepted', 'superseded'].includes(q.status)),
      'A proof record is already waiting for this stop. Open Saved records to sync it.',
    )
    assert(
      Number.isInteger(quantity) && quantity >= 0 && quantity <= stop.cases,
      'Enter the delivered case count.',
    )
    assert(
      receiver.trim().length > 1 || exception.trim().length > 3,
      'Record the receiver name or explain why sign-off is unavailable.',
    )
    assert(
      quantity === stop.cases || exception.trim().length > 3,
      'Explain the quantity shortfall.',
    )
    const verificationErrors = managerSignOffErrors(
      {
        stopId,
        quantity,
        receiver,
        exception,
        fileName: file.name,
        revision: capturedRevision ?? s.settings.routeRevision,
      },
      signature,
      managerSignOff,
    )
    assert(!verificationErrors.length, verificationErrors.join(' '))
    assert(
      signedManifestMatches(stop, s.orders, managerSignOff),
      'The signed order manifest does not match this stop.',
    )
    assert(managerSignOff, 'Store Manager sign-off is required.')
    const digest = await photoDigest(file)
    assert(
      digest === managerSignOff.photoDigest,
      'The delivery photograph changed after manager sign-off.',
    )
    const evidence: Evidence = {
      id: id(),
      kind: 'delivery',
      entityId: stopId,
      photo: file,
      fileName: file.name,
      quantity,
      receiver: receiver.trim(),
      receiverException: exception.trim(),
      signature,
      managerSignOff,
      createdAt: new Date().toISOString(),
      revision: capturedRevision ?? s.settings.routeRevision,
      accepted: false,
    }
    const action: QueuedAction = {
      id: id(),
      evidenceId: evidence.id,
      stopId,
      createdAt: evidence.createdAt,
      status: 'pending',
      attempts: 0,
      revision: evidence.revision,
      kind: 'delivery',
    }
    await this.repository.saveEvidence(evidence, action, (current) => {
      const target = current.stops.find((v) => v.id === stopId)
      assert(
        current.settings.routeStarted &&
          target &&
          isAssignedStop(target, current.orders, assignedDriverLoad(current)) &&
          ['Arrived', 'Proof pending'].includes(target.status),
        'The stop changed while proof was being saved.',
      )
      assert(
        !current.queue.some(
          (q) =>
            q.stopId === stopId &&
            q.id !== action.id &&
            !['accepted', 'superseded'].includes(q.status),
        ),
        'Another proof is already pending for this stop.',
      )
      assert(
        signedManifestMatches(target, current.orders, managerSignOff),
        'The signed manifest changed while proof was being saved. Review and sign again.',
      )
      recordRouteEvent(
        current,
        'proofSaved',
        'Signed proof saved locally; awaiting upload acceptance.',
        target,
      )
      target.status = 'Proof pending'
      target.proofId = evidence.id
      log(current, 'Delivery proof saved locally', `${target.outlet} · waiting for sync acceptance`)
    })
  }
  async reopenProofForSignOff(actionId: string) {
    const current = await this.repository.getSnapshot()
    const driver = current.members.find(
      (member) => member.id === (current.activeDriverId ?? 'USR001'),
    )
    assert(
      driver?.status === 'Active' && driver.role === 'driver',
      'An active assigned driver must reopen this proof.',
    )
    const action = current.queue.find((item) => item.id === actionId)
    assert(action?.kind === 'delivery', 'Select a delivery proof record.')
    const evidence = await this.repository.getEvidence(action.evidenceId)
    const stop = current.stops.find((item) => item.id === action.stopId)
    assert(
      evidence && stop?.proofId === evidence.id,
      'Only the current stop proof can be reopened.',
    )
    assert(
      managerSignOffErrors(
        {
          stopId: stop.id,
          quantity: evidence.quantity ?? 0,
          receiver: evidence.receiver ?? '',
          exception: evidence.receiverException ?? '',
          fileName: evidence.fileName,
          revision: evidence.revision,
        },
        evidence.signature,
        evidence.managerSignOff,
      ).length || !signedManifestMatches(stop, current.orders, evidence.managerSignOff),
      'This proof already has valid sign-off for the current manifest.',
    )
    const draft: DriverProofDraft = {
      stopId: stop.id,
      photo: evidence.photo,
      fileName: evidence.fileName,
      stage: 'attached',
      quantity: evidence.quantity ?? stop.cases,
      receiver: evidence.receiver ?? '',
      exception: evidence.receiverException ?? '',
      acknowledged: false,
      revision: current.settings.routeRevision,
      createdAt: new Date().toISOString(),
      photoDigest: await photoDigest(evidence.photo),
    }
    await this.repository.restoreProofDraft(actionId, draft, (snapshot) => {
      const target = snapshot.stops.find((item) => item.id === stop.id)
      assert(target?.proofId === evidence.id, 'The stop changed while reopening proof.')
      target.status = 'Arrived'
      target.proofId = undefined
      snapshot.settings.routeStarted = true
      const driver = snapshot.members.find(
        (member) => member.id === (snapshot.activeDriverId ?? 'USR001'),
      )
      if (driver) driver.onRoute = true
      snapshot.orders
        .filter((order) => target.orderIds.includes(order.id))
        .forEach((order) => {
          order.status = 'En route'
          order.deliveredAt = undefined
          order.receipt = 'Pending'
          order.receiptAt = undefined
        })
      log(snapshot, 'Proof reopened for manager sign-off', stop.outlet)
    })
  }
  async sync(isOnline: boolean, retryFailed = true) {
    assert(isOnline, 'You are offline. Your records remain saved on this device.')
    assert(!this.syncing, 'Sync is already in progress.')
    this.syncing = true
    try {
      const s = await this.repository.getSnapshot()
      assert(!s.settings.simulatedOffline, 'Demo offline mode is enabled.')
      for (const action of s.queue.filter(
        (q) => q.status === 'pending' || (retryFailed && q.status === 'retry'),
      )) {
        const evidence = await this.repository.getEvidence(action.evidenceId)
        if (!evidence) {
          await this.repository.settleAction(
            action.id,
            'retry',
            'Saved evidence is missing. Record proof again.',
            () => {},
          )
          continue
        }
        await this.repository.update((current) => {
          const q = current.queue.find((v) => v.id === action.id)
          if (q) {
            q.status = 'syncing'
            q.attempts += 1
          }
        })
        try {
          if (evidence.kind === 'delivery') {
            const errors = managerSignOffErrors(
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
            )
            assert(!errors.length, errors.join(' '))
            const stop = s.stops.find((item) => item.id === evidence.entityId)
            if (!stop || !signedManifestMatches(stop, s.orders, evidence.managerSignOff)) {
              await this.repository.settleAction(
                action.id,
                'review',
                'The order manifest changed. Review received quantities and obtain a new manager signature.',
                () => {},
              )
              continue
            }
            assert(
              (await photoDigest(evidence.photo)) === evidence.managerSignOff?.photoDigest,
              'The signed photograph no longer matches its retained digest.',
            )
          }
          const outcome =
            action.revision !== s.settings.routeRevision ? 'review' : s.settings.syncOutcome
          const result = await this.gateway.submit(action, evidence, outcome)
          const latest = await this.repository.getSnapshot()
          if (result.status === 'accepted' && action.revision !== latest.settings.routeRevision) {
            result.status = 'review'
            result.message =
              'A route revision arrived during sync. Review before accepting this record.'
          }
          await this.repository.settleAction(
            action.id,
            result.status,
            result.message,
            (current) => {
              if (result.status === 'accepted') {
                const stop = current.stops.find((v) => v.id === action.stopId)
                if (stop && evidence.kind !== 'attempt') {
                  stop.status = 'Delivered'
                  recordRouteEvent(
                    current,
                    'accepted',
                    'Signed delivery proof accepted by the demo adapter.',
                    stop,
                  )
                  addDeliveryNotice(
                    current,
                    stop,
                    'completed',
                    'Signed delivery recorded',
                    `${evidence.managerSignOff?.managerName} confirmed ${evidence.quantity} cases. ${evidence.managerSignOff?.remarks ?? ''}`,
                    evidence.id,
                  )
                  current.orders
                    .filter((o) => stop.orderIds.includes(o.id))
                    .forEach((o) => {
                      Object.assign(o, {
                        status: 'Delivered',
                        deliveredAt: evidence.managerSignOff?.signedAt ?? evidence.createdAt,
                      })
                      const received = evidence.managerSignOff?.orders.find(
                        (item) => item.orderId === o.id,
                      )
                      if (received) {
                        o.receipt =
                          received.received === received.expected ? 'Confirmed' : 'Issue reported'
                        o.receiptAt = evidence.managerSignOff!.signedAt
                        o.issue =
                          received.received === received.expected
                            ? undefined
                            : evidence.managerSignOff!.remarks
                      }
                    })
                }
                if (current.stops.every((v) => v.status === 'Delivered')) {
                  recordRouteEvent(current, 'completed', 'All assigned outlets completed.')
                  current.settings.routeStarted = false
                  const driver = current.members.find(
                    (m) => m.id === (current.activeDriverId ?? 'USR001'),
                  )
                  if (driver) {
                    driver.onRoute = false
                    if (driver.suspensionScheduled) {
                      driver.status = 'Suspended'
                      driver.suspensionScheduled = false
                    }
                  }
                }
                log(
                  current,
                  evidence.kind === 'attempt'
                    ? 'Demo attempt evidence accepted'
                    : 'Demo proof accepted',
                  action.stopId,
                )
              }
            },
          )
        } catch (error) {
          await this.repository.settleAction(
            action.id,
            'retry',
            error instanceof Error ? error.message : 'Sync failed. Evidence retained.',
            () => {},
          )
        }
      }
    } finally {
      this.syncing = false
    }
  }
  reviewQueuedRecord(actionId: string) {
    return this.repository.update((s) => {
      const q = s.queue.find((v) => v.id === actionId)
      assert(q && q.status === 'review', 'This record does not require route review.')
      q.revision = s.settings.routeRevision
      q.status = 'pending'
      q.message = 'Revised route acknowledged. Original proof is retained.'
      if (s.settings.syncOutcome === 'review') s.settings.syncOutcome = 'accepted'
      log(s, 'Revised route acknowledged', q.stopId)
    })
  }
  confirmReceipt(orderId: string, issue?: string) {
    return this.repository.update((s) => {
      const order = s.orders.find((o) => o.id === orderId)
      assert(
        order && order.status === 'Delivered',
        'Receipt can be recorded after accepted delivery proof.',
      )
      if (issue) assert(issue.trim().length > 3, 'Describe the missing or damaged goods.')
      order.receipt = issue ? 'Issue reported' : 'Confirmed'
      order.receiptAt = new Date().toISOString()
      order.issue = issue
      log(
        s,
        issue ? 'Store issue reported' : 'Store receipt confirmed',
        `${order.id}${issue ? ` · ${issue}` : ''}`,
      )
    })
  }
  createOrder(temperature: 'Ambient' | 'Chilled', cases: number, window: string) {
    return this.repository.update((s) => {
      assert(
        !s.settings.cutoffClosed,
        'The 16:00 cutoff has passed. Save a draft for the next run.',
      )
      assert(Number.isInteger(cases) && cases > 0 && cases <= 100, 'Enter between 1 and 100 cases.')
      assert(!freshWindowErrors(window).length, freshWindowErrors(window).join(' '))
      s.orders.push({
        id: `ORD${Date.now().toString().slice(-7)}`,
        outlet: 'OUT001',
        outletName: 'Fresh Wattala',
        brand: 'Fresh',
        window,
        volume: Number((cases * 0.07).toFixed(2)),
        weight: cases * 10,
        temperature,
        cases,
        status: 'Confirmed',
        priority: false,
        receipt: 'Pending',
        placedAt: new Date().toISOString(),
      })
      log(s, 'Store order confirmed', `${temperature} · ${cases} cases · ${window}`)
    })
  }
  reportStoreReceipt(
    orderId: string,
    kind: 'Missing' | 'Damaged',
    received: number,
    affected: number,
    description: string,
  ) {
    return this.repository.update((s) => {
      const order = s.orders.find((order) => order.id === orderId)
      assert(
        order?.status === 'Delivered',
        'Receipt can be recorded after accepted delivery proof.',
      )
      assert(
        Number.isInteger(received) && received >= 0 && received <= order.cases,
        'Enter the actual received case count.',
      )
      assert(
        Number.isInteger(affected) && affected > 0 && affected <= order.cases,
        'Enter the affected case count.',
      )
      assert(
        kind === 'Missing' ? received + affected === order.cases : affected <= received,
        'Reconcile received and affected quantities with the order.',
      )
      assert(description.trim().length > 3, 'Describe the missing or damaged goods.')
      order.receipt = 'Issue reported'
      order.receiptAt = new Date().toISOString()
      order.issue = `${kind} goods: ${description.trim()}`
      order.receiptReport = {
        kind,
        received,
        affected,
        description: description.trim(),
        recordedAt: new Date().toISOString(),
      }
      log(s, 'Store issue reported', `${order.id} · ${kind} · ${affected} cases`)
    })
  }
  saveStoreDrafts(
    inputs: StoreOrderInput[],
    outlet: { id: string; brand: Order['brand'] } = { id: 'OUT001', brand: 'Fresh' },
  ) {
    return this.repository.update((s) => {
      assert(
        inputs.length >= 1 &&
          inputs.length <= (outlet.brand === 'Fresh' ? 2 : 1) &&
          new Set(inputs.map((input) => input.temperature)).size === inputs.length,
        'Provide at most one chilled and one dry order.',
      )
      for (const input of inputs)
        assert(
          Number.isInteger(input.cases) &&
            input.cases > 0 &&
            input.cases <= 100 &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(input.window),
          'Enter valid quantities and receiving windows.',
        )
      for (const input of inputs)
        s.drafts.push({
          id: id(),
          temperature: input.temperature,
          cases: input.cases,
          window: input.window,
          windowEnd: input.windowEnd,
          weight: input.weight,
          volume: input.volume,
          outlet: outlet.id,
        })
      log(s, 'Store drafts saved', `${outlet.id} · next eligible run`)
    })
  }
  saveDraft(temperature: 'Ambient' | 'Chilled', cases: number, window: string) {
    return this.repository.update((s) => {
      assert(Number.isInteger(cases) && cases > 0 && cases <= 100, 'Enter between 1 and 100 cases.')
      s.drafts.push({ id: id(), temperature, cases, window })
      log(s, 'Store draft saved', `${temperature} · ${cases} cases · next eligible run`)
    })
  }
  editOrder(orderId: string, cases: number, window: string) {
    return this.repository.update((s) => {
      assert(
        !s.settings.cutoffClosed && !s.settings.published,
        'Intake is closed. Save a new draft for the next run.',
      )
      assert(Number.isInteger(cases) && cases > 0 && cases <= 100, 'Enter between 1 and 100 cases.')
      const order = s.orders.find((o) => o.id === orderId)
      assert(order && order.outlet === 'OUT001', 'Select an order for this store.')
      if (order.brand === 'Fresh')
        assert(!freshWindowErrors(window).length, freshWindowErrors(window).join(' '))
      order.windowEnd = receivingWindowEnd(window, undefined, order.brand === 'Fresh')
      const factor = cases / order.cases
      order.weight = Math.round(order.weight * factor)
      order.volume = Number((order.volume * factor).toFixed(2))
      order.cases = cases
      order.window = window
      order.status = 'Confirmed'
      order.vehicleId = undefined
      order.trip = undefined
      const stop = s.stops.find((v) => v.orderIds.includes(order.id))
      if (stop) {
        stop.cases = s.orders
          .filter((o) => stop.orderIds.includes(o.id))
          .reduce((n, o) => n + o.cases, 0)
        for (const load of s.loads) {
          const item = load.items.find((i) => i.outlet === stop.outlet)
          if (item) {
            item.expected = stop.cases
            item.loaded = Math.min(item.loaded, item.expected)
            load.photoId = undefined
            load.completed = false
            load.checks = { refrigeration: false, condition: false, restraints: false }
          }
        }
      }
      log(s, 'Store order edited', `${order.id} · ${cases} cases · ${window}`)
    })
  }
  confirmStoreOrders(
    inputs: StoreOrderInput[],
    outlet: { id: string; name: string; brand: Order['brand'] } = {
      id: 'OUT001',
      name: 'Fresh Wattala',
      brand: 'Fresh',
    },
  ) {
    return this.repository.update((s) => {
      assert(
        !s.settings.cutoffClosed && !s.settings.published,
        'Intake is closed. Save the orders for the next run.',
      )
      // Chilled is not ordered every day, so one dry order alone is valid. Style and Tech place a
      // single order per delivery.
      assert(
        inputs.length >= 1 &&
          inputs.length <= (outlet.brand === 'Fresh' ? 2 : 1) &&
          new Set(inputs.map((input) => input.temperature)).size === inputs.length,
        'Confirm at most one chilled and one dry order.',
      )
      s.settings.allocationReviewed = false
      for (const input of inputs) {
        assert(
          Number.isInteger(input.cases) && input.cases > 0 && input.cases <= 100,
          'Enter between 1 and 100 cases for each order.',
        )
        assert(
          Number.isFinite(input.weight) &&
            input.weight > 0 &&
            Number.isFinite(input.volume) &&
            input.volume > 0,
          'Enter a positive weight and volume for each order.',
        )
        if (outlet.brand === 'Fresh')
          assert(
            !freshWindowErrors(input.window, input.windowEnd).length,
            freshWindowErrors(input.window, input.windowEnd).join(' '),
          )
        assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(input.window), 'Enter a valid receiving window.')
        assert(
          !input.windowEnd ||
            (/^([01]\d|2[0-3]):[0-5]\d$/.test(input.windowEnd) && input.windowEnd > input.window),
          'The receiving window must end after it starts.',
        )
      }
      const placedAt = new Date().toISOString()
      for (const { orderId, ...input } of inputs) {
        // Tech orders as needed, so each order stands alone: a new one is added unless an existing
        // order is being changed. Fresh and Style have one live order per kind.
        const order =
          outlet.brand === 'Tech'
            ? orderId
              ? s.orders.find((o) => o.id === orderId && o.outlet === outlet.id)
              : undefined
            : s.orders.find((o) => o.outlet === outlet.id && o.temperature === input.temperature)
        assert(!orderId || order, 'That order is no longer open. Start a new order instead.')
        if (order)
          Object.assign(order, input, {
            status: 'Confirmed',
            vehicleId: undefined,
            trip: undefined,
            placedAt,
          })
        else
          s.orders.push({
            ...input,
            id: `ORD${Date.now().toString().slice(-7)}${
              outlet.brand === 'Tech'
                ? `T${s.orders.filter((o) => o.outlet === outlet.id).length + 1}`
                : input.temperature === 'Chilled'
                  ? 'C'
                  : 'A'
            }`,
            outlet: outlet.id,
            outletName: outlet.name,
            brand: outlet.brand,
            status: 'Confirmed',
            priority: false,
            receipt: 'Pending',
            placedAt,
          })
      }
      for (const stop of s.stops.filter((stop) => stop.outlet === outlet.id)) {
        stop.cases = s.orders
          .filter((order) => stop.orderIds.includes(order.id))
          .reduce((sum, order) => sum + order.cases, 0)
        for (const load of s.loads) {
          const item = load.items.find((item) => item.outlet === stop.outlet)
          if (!item) continue
          item.expected = stop.cases
          item.loaded = Math.min(item.loaded, item.expected)
          load.photoId = undefined
          load.completed = false
          load.checks = { refrigeration: false, condition: false, restraints: false }
        }
      }
      log(s, 'Store orders confirmed', `${outlet.id} · ${outlet.brand} demand recorded`)
    })
  }
  /** Withdraws an order that has not been published into a plan; only before the cutoff. */
  cancelStoreOrder(orderId: string) {
    return this.repository.update((s) => {
      assert(
        !s.settings.cutoffClosed && !s.settings.published,
        'Intake is closed. This order is locked; ask the dispatcher to change it.',
      )
      const order = s.orders.find((o) => o.id === orderId)
      assert(order, 'Select an order for this store.')
      assert(
        order.status === 'Confirmed' || order.status === 'Allocated',
        'Only an order that is still waiting for the plan can be cancelled.',
      )
      s.orders = s.orders.filter((o) => o.id !== orderId)
      // Kept in the history so the store can see what it withdrew and when.
      s.orderHistory = [
        ...(s.orderHistory ?? []),
        { ...order, vehicleId: undefined, trip: undefined, cancelledAt: new Date().toISOString() },
      ]
      s.settings.allocationReviewed = false
      for (const stop of s.stops.filter((candidate) => candidate.orderIds.includes(orderId))) {
        stop.orderIds = stop.orderIds.filter((id) => id !== orderId)
        stop.cases = s.orders
          .filter((o) => stop.orderIds.includes(o.id))
          .reduce((sum, o) => sum + o.cases, 0)
        for (const load of s.loads) {
          const item = load.items.find((candidate) => candidate.outlet === stop.outlet)
          if (!item) continue
          if (stop.orderIds.length === 0) load.items = load.items.filter((entry) => entry !== item)
          else {
            item.expected = stop.cases
            item.loaded = Math.min(item.loaded, item.expected)
          }
          load.photoId = undefined
          load.completed = false
          load.checks = { refrigeration: false, condition: false, restraints: false }
        }
      }
      s.stops = s.stops.filter((stop) => stop.orderIds.length > 0 || stop.outlet !== order.outlet)
      log(s, 'Store order cancelled', order.id)
    })
  }
  acknowledgeDeferral(orderId: string) {
    return this.repository.update((s) => {
      const order = s.orders.find((o) => o.id === orderId)
      assert(order && order.status === 'Deferred', 'This order is not deferred.')
      order.deferralAcknowledged = true
      order.deferralAcknowledgedAt = new Date().toISOString()
      log(s, 'Store deferral acknowledged', order.id)
    })
  }
  reportDelay(
    stopId: string,
    note: string,
    revisedEta?: string,
    kind: 'delay' | 'breakdown' = 'delay',
  ) {
    return this.repository.update((current) => {
      const stop = current.stops.find((item) => item.id === stopId)
      assert(
        current.settings.routeStarted &&
          stop &&
          isAssignedStop(stop, current.orders, assignedDriverLoad(current)) &&
          ['Upcoming', 'Arrived'].includes(stop.status),
        'Select an open stop on your started route.',
      )
      assert(note.trim().length > 3, 'Describe the delay for dispatch.')
      assert(
        !revisedEta || clockMinutes(revisedEta) !== undefined,
        'Enter a valid revised arrival time.',
      )
      const label = kind === 'breakdown' ? 'Vehicle breakdown' : 'Delay'
      stop.issue = `${label}: ${note.trim()}`
      if (revisedEta && stop.status === 'Upcoming') {
        stop.originalEta ??= stop.eta
        stop.eta = revisedEta
        stop.etaUpdatedAt = new Date().toISOString()
      }
      const detail = `${note.trim()} · ${revisedEta ? 'Driver estimate' : 'Planned ETA'} ${stop.eta}. Delivery remains open; dispatch must decide any reschedule or cancellation.`
      addDeliveryNotice(
        current,
        stop,
        'delay',
        kind === 'breakdown' ? 'Vehicle breakdown reported' : 'Delivery delayed',
        detail,
        `${kind}:${note.trim()}:${revisedEta ?? ''}`,
      )
      recordRouteEvent(current, kind, detail, stop)
      log(current, 'Driver delay saved locally', `${stop.outlet} · ${note.trim()}`)
    })
  }
  reportDeliveryIssue(stopId: string, issue: string) {
    return this.repository.update((s) => {
      const stop = s.stops.find((v) => v.id === stopId)
      assert(
        stop &&
          s.settings.routeStarted &&
          isAssignedStop(stop, s.orders, assignedDriverLoad(s)) &&
          issue.trim().length > 3,
        'Start the route and describe the delivery issue.',
      )
      assert(
        !['Delivered', 'Proof pending'].includes(stop.status),
        'Use the saved proof record for an in-progress or accepted delivery.',
      )
      stop.issue = issue
      stop.status = 'Cannot deliver'
      addDeliveryNotice(
        s,
        stop,
        'issue',
        'Delivery could not be completed',
        issue.trim(),
        issue.trim(),
      )
      recordRouteEvent(s, 'attempt', issue, stop)
      log(s, 'Delivery attempt reported', `${stop.outlet} · ${issue}`)
    })
  }
  async saveAttemptProof(stopId: string, file: File, issue: string) {
    checkPhoto(file)
    const s = await this.repository.getSnapshot(),
      stop = s.stops.find((v) => v.id === stopId)
    assert(
      stop &&
        s.settings.routeStarted &&
        isAssignedStop(stop, s.orders, assignedDriverLoad(s)) &&
        issue.trim().length > 3,
      'Start the route and describe the unsuccessful attempt.',
    )
    assert(
      !['Delivered', 'Proof pending'].includes(stop.status),
      'This stop already has delivery proof in progress or accepted.',
    )
    assert(
      !s.queue.some((q) => q.stopId === stopId && !['accepted', 'superseded'].includes(q.status)),
      'Sync the existing record before recording another attempt.',
    )
    const evidence: Evidence = {
      id: id(),
      kind: 'attempt',
      entityId: stopId,
      photo: file,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      revision: s.settings.routeRevision,
      accepted: false,
      receiverException: issue,
    }
    const queue: QueuedAction = {
      id: id(),
      evidenceId: evidence.id,
      stopId,
      createdAt: evidence.createdAt,
      status: 'pending',
      attempts: 0,
      revision: evidence.revision,
      kind: 'attempt',
    }
    await this.repository.saveEvidence(evidence, queue, (current) => {
      const target = current.stops.find((v) => v.id === stopId)
      assert(
        target && !['Delivered', 'Proof pending'].includes(target.status),
        'This stop has changed. Review its current state.',
      )
      assert(
        !current.queue.some(
          (q) =>
            q.stopId === stopId &&
            q.id !== queue.id &&
            !['accepted', 'superseded'].includes(q.status),
        ),
        'Another record is waiting for this stop.',
      )
      target.status = 'Cannot deliver'
      addDeliveryNotice(
        current,
        target,
        'issue',
        'Delivery could not be completed',
        issue.trim(),
        issue.trim(),
      )
      recordRouteEvent(current, 'attempt', issue, target)
      target.issue = issue
      target.proofId = evidence.id
      log(
        current,
        'Attempt evidence saved locally',
        `${target.outlet} · delivery remains incomplete`,
      )
    })
  }
  retryStop(stopId: string) {
    return this.repository.update((s) => {
      const stop = s.stops.find((v) => v.id === stopId)
      assert(
        stop &&
          isAssignedStop(stop, s.orders, assignedDriverLoad(s)) &&
          stop.status === 'Cannot deliver',
        'This stop does not require a retry.',
      )
      assert(
        !s.queue.some((q) => q.stopId === stopId && !['accepted', 'superseded'].includes(q.status)),
        'Sync the saved attempt evidence before retrying.',
      )
      stop.status = 'Upcoming'
      stop.arrivedAt = undefined
      stop.issue = undefined
      stop.proofId = undefined
      recordRouteEvent(s, 'reopened', 'Delivery reopened; previous attempt retained.', stop)
      log(s, 'Delivery stop reopened', `${stop.outlet} · previous attempt evidence retained`)
    })
  }
  async saveProfilePhoto(file: File) {
    checkPhoto(file)
    const snapshot = await this.repository.getSnapshot()
    const evidence: Evidence = {
      id: id(),
      kind: 'profile',
      entityId: snapshot.activeDriverId ?? 'USR001',
      photo: file,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      revision: 0,
      accepted: false,
    }
    await this.repository.saveEvidence(evidence, undefined, (current) => {
      current.settings.profilePhotoId = evidence.id
      log(current, 'Profile photo saved locally', evidence.entityId)
    })
  }
  updateSettings(values: Partial<Settings>) {
    return this.repository.update((s) => {
      if (values.profilePhone !== undefined) {
        const phone = values.profilePhone.replace(/[^\d+]/g, '')
        assert(/^\+947\d{8}$/.test(phone), 'Enter a valid Sri Lankan mobile number.')
        const driver = s.members.find((member) => member.id === (s.activeDriverId ?? 'USR001'))
        if (driver) driver.mobile = values.profilePhone
      }
      Object.assign(s.settings, values)
    })
  }
  invite(name: string, email: string, role: Workspace) {
    return this.repository.update((s) => {
      assert(
        name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        'Enter a name and valid email address.',
      )
      assert(
        !s.members.some((m) => m.email.toLowerCase() === email.toLowerCase()),
        'This email already belongs to a team member.',
      )
      s.members.push({
        id: id(),
        name: name.trim(),
        email,
        role,
        status: 'Invited',
        onRoute: false,
      })
      log(s, 'Demo invitation created', `${email} · no email sent`)
    })
  }
  inviteByMobile(input: MobileInvitation) {
    return this.repository.update((s) => {
      const mobile = input.mobile.replace(/[^\d+]/g, '')
      assert(
        input.name.trim().length > 1 && /^\+947\d{8}$/.test(mobile),
        'Enter a full name and valid Sri Lankan mobile number.',
      )
      assert(['Peliyagoda', 'Kandy'].includes(input.depot), 'Choose Peliyagoda or Kandy.')
      assert(input.assignment.trim().length > 1, 'Choose an assignment for this role.')
      const existing = s.members.find((member) => member.mobile?.replace(/[^\d+]/g, '') === mobile)
      assert(
        !existing || existing.status === 'Invited',
        'This mobile number already belongs to a team member.',
      )
      const invitation: TeamMember = {
        id: existing?.id ?? id(),
        name: input.name.trim(),
        email: '',
        mobile: input.mobile.trim(),
        role: input.role,
        depot: input.depot,
        assignment: input.assignment.trim(),
        vehicleId: input.role === 'driver' ? /VEH\d+/.exec(input.assignment)?.[0] : undefined,
        outletId: input.role === 'store-manager' ? /OUT\d+/.exec(input.assignment)?.[0] : undefined,
        status: 'Invited',
        onRoute: false,
        accessState: 'Invitation pending',
        invitationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }
      if (existing) Object.assign(existing, invitation)
      else s.members.push(invitation)
      log(
        s,
        'Demo SMS invitation recorded',
        `${invitation.name} · ${invitation.mobile} · no SMS sent`,
      )
    })
  }
  resetAccess(memberId: string) {
    return this.repository.update((s) => {
      const member = s.members.find((member) => member.id === memberId)
      assert(member, 'Team member was not found.')
      member.accessState = 'Recovery requested'
      log(s, 'Demo access recovery requested', `${member.name} · no message sent`)
    })
  }
  /** A person's own contact details. Role, outlet and depot are changed by an administrator. */
  updateMemberContact(memberId: string, contact: { name: string; mobile: string; email: string }) {
    return this.repository.update((s) => {
      const member = s.members.find((candidate) => candidate.id === memberId)
      assert(member, 'Select a team member.')
      const name = contact.name.trim()
      const mobile = contact.mobile.trim()
      const email = contact.email.trim()
      assert(name.length >= 2, 'Enter your full name.')
      assert(/^[+\d][\d\s-]{6,}$/.test(mobile), 'Enter a phone number with at least 7 digits.')
      assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.')
      Object.assign(member, { name, mobile, email })
      log(s, 'Contact details updated', member.name)
    })
  }
  requestAccountChange(memberId: string, detail: string) {
    return this.repository.update((s) => {
      const member = s.members.find((member) => member.id === memberId)
      assert(member && detail.trim().length > 3, 'Describe the requested account change.')
      log(s, 'Demo account change requested', `${member.name} · ${detail.trim()}`)
    })
  }
  completeInvitation(memberId: string) {
    return this.repository.update((s) => {
      const member = s.members.find((member) => member.id === memberId)
      assert(member && member.status === 'Invited', 'Select a pending invitation.')
      member.status = 'Active'
      member.accessState = 'Ready'
      log(s, 'Demo invitation accepted', member.name)
    })
  }
  changeAssignment(memberId: string, depot: string, assignment: string) {
    return this.repository.update((s) => {
      const member = s.members.find((member) => member.id === memberId)
      assert(member && !member.onRoute, 'Reassign the active trip before changing assignments.')
      assert(
        ['Peliyagoda', 'Kandy'].includes(depot) && assignment.trim().length > 1,
        'Choose a depot and assignment.',
      )
      member.depot = depot
      member.assignment = assignment.trim()
      member.vehicleId = member.role === 'driver' ? /VEH\d+/.exec(assignment)?.[0] : undefined
      member.outletId = member.role === 'store-manager' ? /OUT\d+/.exec(assignment)?.[0] : undefined
      if (member.role === 'driver' && member.vehicleId === 'VEH055' && !s.settings.routeStarted)
        s.activeDriverId = member.id
      log(s, 'Demo assignment changed', `${member.name} · ${depot} · ${assignment}`)
    })
  }
  reassignTrip(fromId: string, toId: string) {
    return this.repository.update((s) => {
      const from = s.members.find((member) => member.id === fromId)
      const to = s.members.find((member) => member.id === toId)
      assert(from && from.onRoute, 'Select the driver with an active route.')
      assert(
        to && to.role === 'driver' && to.status === 'Active' && !to.onRoute && fromId !== toId,
        'Choose an available active driver for the handover.',
      )
      to.assignment = from.assignment
      to.vehicleId = from.vehicleId
      to.onRoute = true
      from.onRoute = false
      s.activeDriverId = to.id
      s.settings.profileName = to.name
      s.settings.profilePhone = to.mobile ?? ''
      s.settings.profilePhotoId = undefined
      s.settings.emergencyContact = undefined
      if (from.suspensionScheduled) {
        from.status = 'Suspended'
        from.suspensionScheduled = false
      }
      log(s, 'Demo trip reassigned', `${from.name} → ${to.name} · ${to.assignment ?? ''}`)
    })
  }
  updateMember(memberId: string, role: Workspace) {
    return this.repository.update((s) => {
      const member = s.members.find((m) => m.id === memberId)
      assert(member && !member.onRoute, 'Hand over the active route before changing this role.')
      member.role = role
      log(s, 'Demo role updated', `${member.name} · ${role}`)
    })
  }
  suspend(memberId: string, scheduled = false) {
    return this.repository.update((s) => {
      const member = s.members.find((m) => m.id === memberId)
      assert(member, 'Team member was not found.')
      assert(
        !member.onRoute || scheduled,
        'This driver is on route. Schedule suspension or complete the trip first.',
      )
      if (scheduled && member.onRoute) member.suspensionScheduled = true
      else member.status = 'Suspended'
      log(
        s,
        'Demo suspension updated',
        `${member.name} · ${scheduled ? 'after trip' : 'suspended'}`,
      )
    })
  }
  capacityScenario() {
    return this.repository.update((s) => {
      assert(!s.settings.published, 'Reset the demo before changing a published plan.')
      const order = s.orders.find((o) => o.id === 'ORD1051')
      if (order)
        Object.assign(order, {
          volume: 16,
          status: 'Confirmed',
          vehicleId: undefined,
          trip: undefined,
        })
      log(s, 'Demo scenario enabled', 'ORD1051 exceeds available volume capacity')
    })
  }
}
