import type { OperationsRepository, SyncGateway } from '../domain/ports'
import type {
  Evidence,
  Load,
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
      // The demo operator handles VEH055 Trip 1. Project its manifest from the
      // published allocations so manual changes cannot leave stale case counts.
      const load = s.loads[0]
      const assigned = s.orders.filter(
        (o) => o.vehicleId === load.vehicleId && o.trip === load.trip && o.status === 'Scheduled',
      )
      const outlets = [...new Set(assigned.map((o) => o.outlet))].sort((a, b) => {
        const earliest = (outlet: string) =>
          assigned
            .filter((o) => o.outlet === outlet)
            .map((o) => o.window)
            .sort()[0]
        return earliest(a).localeCompare(earliest(b))
      })
      s.stops = outlets.map((outlet, index) => {
        const orders = assigned.filter((o) => o.outlet === outlet),
          existing = s.stops.find((stop) => stop.outlet === outlet)
        return {
          id: `STOP${outlet.slice(3)}`,
          outlet,
          name: orders[0].outletName,
          address: existing?.address ?? `${outlet} receiving bay · demo location`,
          window: existing?.window ?? `${orders[0].window} · scheduled`,
          eta: existing?.eta ?? orders[0].window,
          lat: existing?.lat ?? 6.95 + index * 0.008,
          lng: existing?.lng ?? 79.9 + index * 0.006,
          orderIds: orders.map((order) => order.id),
          cases: orders.reduce((n, order) => n + order.cases, 0),
          status: 'Upcoming' as const,
        }
      })
      load.items = [...s.stops].reverse().map((stop) => ({
        outlet: stop.outlet,
        name: stop.name,
        expected: stop.cases,
        loaded: 0,
        stop: s.stops.indexOf(stop) + 1,
      }))
      load.checks = { refrigeration: false, condition: false, restraints: false }
      load.photoId = undefined
      load.completed = false
      log(
        s,
        'Plan published',
        'Reviewed allocations shared with loading; departure still requires proof',
      )
    })
  }
  editLoad(loadId: string, update: (load: Load) => void) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId)
      assert(!load.released, 'This vehicle has departed. Loading is locked.')
      update(load)
      if (loadErrors(load, false).length) {
        load.photoId = undefined
        load.completed = false
      }
    })
  }
  setLoaded(loadId: string, outlet: string, quantity: number) {
    return this.editLoad(loadId, (load) => {
      const item = load.items.find((i) => i.outlet === outlet)
      assert(
        item && Number.isInteger(quantity) && quantity >= 0 && quantity <= item.expected,
        'Enter a valid case count.',
      )
      item.loaded = quantity
    })
  }
  setCheck(loadId: string, key: keyof Load['checks'], checked: boolean) {
    return this.editLoad(loadId, (load) => {
      load.checks[key] = checked
    })
  }
  reportLoadIssue(loadId: string, issue: string) {
    assert(issue.trim().length > 3, 'Describe the missing or damaged goods.')
    return this.editLoad(loadId, (load) => {
      load.issue = issue
      load.issueResolved = false
      load.completed = false
    })
  }
  resolveLoadIssue(loadId: string) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId)
      assert(!load.released, 'Loading has already been released.')
      load.issueResolved = true
      load.revision += 1
      load.photoId = undefined
      load.completed = false
      load.checks = { refrigeration: false, condition: false, restraints: false }
      s.settings.routeRevision = load.revision
      log(
        s,
        'Demo manifest revised',
        `${load.vehicleId} · Revision ${load.revision}; recheck quantities and attach fresh proof`,
      )
    })
  }
  async attachLoadingPhoto(loadId: string, file: File) {
    checkPhoto(file)
    const s = await this.repository.getSnapshot(),
      load = requireLoad(s, loadId)
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
      assert(
        target.revision === evidence.revision &&
          !loadErrors(target, false).length &&
          !target.released,
        'Loading changed while the photograph was being saved. Review the load again.',
      )
      target.photoId = evidence.id
      log(current, 'Loading photograph saved', `${target.vehicleId} · Revision ${target.revision}`)
    })
  }
  completeLoading(loadId: string) {
    return this.repository.update((s) => {
      const load = requireLoad(s, loadId),
        errors = loadErrors(load)
      assert(!errors.length, errors[0] ?? 'Loading is incomplete.')
      load.completed = true
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
      log(s, 'Demo departure released', `${load.vehicleId} · Trip ${load.trip}`)
    })
  }
  startRoute() {
    return this.repository.update((s) => {
      assert(
        s.loads[0]?.released,
        'The Dispatcher must release the vehicle after loading proof is complete.',
      )
      s.settings.routeStarted = true
      const driver = s.members.find((m) => m.id === (s.activeDriverId ?? 'USR001'))
      assert(
        driver?.status === 'Active' && driver.role === 'driver',
        'An active assigned driver is required before departure.',
      )
      if (driver) driver.onRoute = true
      log(s, 'Demo route started', 'Sanjeewa · VEH055 · Trip 1')
    })
  }
  arrive(stopId: string) {
    return this.repository.update((s) => {
      assert(s.settings.routeStarted, 'Check and start your route first.')
      const stop = s.stops.find((v) => v.id === stopId)
      assert(stop && stop.status === 'Upcoming', 'This stop is already in progress or complete.')
      stop.status = 'Arrived'
      log(s, 'Arrived at outlet', stop.outlet)
    })
  }
  async saveDeliveryProof(
    stopId: string,
    file: File,
    quantity: number,
    receiver: string,
    exception: string,
    signature?: Blob,
  ) {
    checkPhoto(file)
    if (signature) checkPhoto(signature)
    const s = await this.repository.getSnapshot(),
      stop = s.stops.find((v) => v.id === stopId)
    assert(
      stop && ['Arrived', 'Proof pending'].includes(stop.status),
      'Arrive at this stop before recording proof.',
    )
    assert(
      !s.queue.some((q) => q.stopId === stopId && q.status !== 'accepted'),
      'A proof record is already waiting for this stop. Use Recovery to sync it.',
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
      createdAt: new Date().toISOString(),
      revision: s.settings.routeRevision,
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
        target && ['Arrived', 'Proof pending'].includes(target.status),
        'The stop changed while proof was being saved.',
      )
      assert(
        !current.queue.some(
          (q) => q.stopId === stopId && q.id !== action.id && q.status !== 'accepted',
        ),
        'Another proof is already pending for this stop.',
      )
      target.status = 'Proof pending'
      target.proofId = evidence.id
      log(current, 'Delivery proof saved locally', `${target.outlet} · waiting for sync acceptance`)
    })
  }
  async sync(isOnline: boolean) {
    assert(isOnline, 'You are offline. Your records remain saved on this device.')
    assert(!this.syncing, 'Sync is already in progress.')
    this.syncing = true
    try {
      const s = await this.repository.getSnapshot()
      assert(!s.settings.simulatedOffline, 'Demo offline mode is enabled.')
      for (const action of s.queue.filter((q) => ['pending', 'retry'].includes(q.status))) {
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
                  current.orders
                    .filter((o) => stop.orderIds.includes(o.id))
                    .forEach((o) => {
                      Object.assign(o, { status: 'Delivered', deliveredAt: evidence.createdAt })
                    })
                }
                if (current.stops.every((v) => v.status === 'Delivered')) {
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
  saveStoreDrafts(inputs: StoreOrderInput[]) {
    return this.repository.update((s) => {
      assert(
        inputs.length >= 1 &&
          inputs.length <= 2 &&
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
        })
      log(s, 'Store drafts saved', 'Chilled and dry orders · next eligible run')
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
        assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(input.window), 'Enter a valid receiving window.')
        assert(
          !input.windowEnd ||
            (/^([01]\d|2[0-3]):[0-5]\d$/.test(input.windowEnd) && input.windowEnd > input.window),
          'The receiving window must end after it starts.',
        )
      }
      const placedAt = new Date().toISOString()
      for (const input of inputs) {
        const order = s.orders.find(
          (o) => o.outlet === outlet.id && o.temperature === input.temperature,
        )
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
            id: `ORD${Date.now().toString().slice(-7)}${input.temperature === 'Chilled' ? 'C' : 'A'}`,
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
  reportDeliveryIssue(stopId: string, issue: string) {
    return this.repository.update((s) => {
      const stop = s.stops.find((v) => v.id === stopId)
      assert(
        stop && s.settings.routeStarted && issue.trim().length > 3,
        'Start the route and describe the delivery issue.',
      )
      assert(
        !['Delivered', 'Proof pending'].includes(stop.status),
        'Use the saved proof record for an in-progress or accepted delivery.',
      )
      stop.issue = issue
      stop.status = 'Cannot deliver'
      log(s, 'Delivery attempt reported', `${stop.outlet} · ${issue}`)
    })
  }
  async saveAttemptProof(stopId: string, file: File, issue: string) {
    checkPhoto(file)
    const s = await this.repository.getSnapshot(),
      stop = s.stops.find((v) => v.id === stopId)
    assert(
      stop && s.settings.routeStarted && issue.trim().length > 3,
      'Start the route and describe the unsuccessful attempt.',
    )
    assert(
      !['Delivered', 'Proof pending'].includes(stop.status),
      'This stop already has delivery proof in progress or accepted.',
    )
    assert(
      !s.queue.some((q) => q.stopId === stopId && q.status !== 'accepted'),
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
          (q) => q.stopId === stopId && q.id !== queue.id && q.status !== 'accepted',
        ),
        'Another record is waiting for this stop.',
      )
      target.status = 'Cannot deliver'
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
      assert(stop && stop.status === 'Cannot deliver', 'This stop does not require a retry.')
      assert(
        !s.queue.some((q) => q.stopId === stopId && q.status !== 'accepted'),
        'Sync the saved attempt evidence before retrying.',
      )
      stop.status = 'Upcoming'
      stop.issue = undefined
      stop.proofId = undefined
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
