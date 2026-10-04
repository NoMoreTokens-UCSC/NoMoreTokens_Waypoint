import { DriverSignalsService } from '../../application/DriverSignalsService'
import type { Apis } from '../../domain/api'
import { memberActivityReference } from '../demo/teamReference'
import { assignedDriverLoad, isAssignedStop } from '../../domain/driverWorkflow'
import { tripsFromOrders } from '../../domain/trips'
import type { OperationsService } from '../../application/OperationsService'

/**
 * Implements the API contract in the browser over IndexedDB, through the existing
 * OperationsService. Replace these with HTTP adapters in src/app/apis.ts; screens using
 * useApis() keep working unchanged.
 */
export function createLocalApis(service: OperationsService): Apis {
  const snapshot = () => service.repository.getSnapshot()
  /** The outlet's profile, or an error when it is not set up (orders need its brand and hours). */
  const requireOutlet = async (outletId: string) => {
    const outlet = (await snapshot()).outlets?.find((candidate) => candidate.id === outletId)
    if (!outlet) throw new Error(`Outlet ${outletId} is not set up.`)
    return outlet
  }
  const signals = new DriverSignalsService(service.repository)
  return {
    driverSignals: {
      registerPushSubscription: (subscription) => signals.registerPushSubscription(subscription),
      recordPosition: (position) => signals.recordPosition(position),
      pendingPositions: () => signals.pendingPositions(),
      listNotices: (outletId) => signals.listNotices(outletId),
      acknowledgeNotice: (id) => signals.acknowledgeNotice(id),
      checkDeliveryWindows: (now) => signals.checkDeliveryWindows(now),
    },
    outlets: {
      listOutlets: async () => (await snapshot()).outlets ?? [],
      createOutlet: (input) => service.createOutlet(input),
    },
    orders: {
      listOrders: async (filter = {}) =>
        (await snapshot()).orders.filter(
          (order) =>
            (!filter.outletId || order.outlet === filter.outletId) &&
            (!filter.status || order.status === filter.status),
        ),
      listHistory: async (filter = {}) =>
        ((await snapshot()).orderHistory ?? [])
          .filter((order) => !filter.outletId || order.outlet === filter.outletId)
          .sort((a, b) => (b.deliveryDate ?? '').localeCompare(a.deliveryDate ?? '')),
      getOutletProfile: (outletId) => requireOutlet(outletId),
      listDrafts: async () => (await snapshot()).drafts,
      getIntakeStatus: async () => {
        const { cutoffClosed, published } = (await snapshot()).settings
        return { cutoffClosed, published }
      },
      createOrder: async (outletId, temperature, cases, window) => {
        if ((await requireOutlet(outletId)).id !== 'OUT001')
          throw new Error('createOrder models OUT001 only; use placeOrders.')
        await service.createOrder(temperature, cases, window)
      },
      placeOrders: async (outletId, inputs) => {
        const profile = await requireOutlet(outletId)
        await service.confirmStoreOrders(inputs, profile)
      },
      editOrder: (orderId, cases, window) => service.editOrder(orderId, cases, window),
      saveDraft: (temperature, cases, window) => service.saveDraft(temperature, cases, window),
      saveDrafts: async (outletId, inputs) => {
        const profile = await requireOutlet(outletId)
        await service.saveStoreDrafts(inputs, profile)
      },
      confirmReceipt: (orderId) => service.confirmReceipt(orderId),
      reportReceiptIssue: (orderId, issue) =>
        service.reportStoreReceipt(
          orderId,
          issue.kind,
          issue.received,
          issue.affected,
          issue.description,
        ),
      cancelOrder: (orderId) => service.cancelStoreOrder(orderId),
      acknowledgeDeferral: (orderId) => service.acknowledgeDeferral(orderId),
    },
    planning: {
      getPlan: async () => {
        const current = await snapshot()
        const { cutoffClosed, published, allocationReviewed } = current.settings
        return {
          orders: current.orders,
          trips: tripsFromOrders(current),
          status: { cutoffClosed, published, allocationReviewed },
        }
      },
      allocate: (orderId, vehicleId, trip) => service.allocate(orderId, vehicleId, trip),
      unallocate: (orderId) => service.unallocate(orderId),
      autoAllocate: () => service.autoAllocate(),
      defer: (orderId, reason) => service.defer(orderId, reason),
      reviewAllocation: () => service.reviewAllocation(),
      publish: () => service.publish(),
      release: (loadId) => service.release(loadId),
    },
    loading: {
      listLoads: async (filter = {}) =>
        (await snapshot()).loads.filter((load) => !filter.depot || load.depot === filter.depot),
      getLoad: async (loadId) => (await snapshot()).loads.find((load) => load.id === loadId),
      getWorkspace: async (loadId, depot) => {
        const current = await snapshot()
        const load = current.loads.find(
          (entry) => entry.id === loadId && (!depot || entry.depot === depot),
        )
        const vehicle = current.vehicles.find((entry) => entry.id === load?.vehicleId)
        if (!load || !vehicle) return undefined
        const orders = current.orders.filter(
          (order) =>
            order.vehicleId === load.vehicleId &&
            order.trip === load.trip &&
            order.status !== 'Deferred',
        )
        return {
          load: { ...load, items: [...load.items].sort((a, b) => b.stop - a.stop) },
          vehicle,
          published: current.settings.published,
          stops: current.stops.filter(
            (stop) =>
              stop.loadId === load.id ||
              (!stop.loadId && stop.orderIds.some((id) => orders.some((order) => order.id === id))),
          ),
          weight: orders.reduce((total, order) => total + order.weight, 0),
          volume: orders.reduce((total, order) => total + order.volume, 0),
        }
      },
      acknowledgeRevision: (loadId, revision) => service.acknowledgeLoadRevision(loadId, revision),
      setLoaded: (loadId, outlet, quantity, revision) =>
        service.setLoaded(loadId, outlet, quantity, revision),
      setCheck: (loadId, check, checked, revision) =>
        service.setCheck(loadId, check, checked, revision),
      reportIssue: (loadId, issue, revision) => service.reportLoadIssue(loadId, issue, revision),
      resolveIssue: (loadId) => service.resolveLoadIssue(loadId),
      attachPhoto: (loadId, file, revision) => service.attachLoadingPhoto(loadId, file, revision),
      complete: (loadId, revision) => service.completeLoading(loadId, revision),
    },
    delivery: {
      getRoute: async () => {
        const current = await snapshot()
        const driver = current.members.find(
          (member) => member.id === (current.activeDriverId ?? 'USR001'),
        )
        const load = current.loads
          .filter((load) => load.vehicleId === driver?.vehicleId)
          .sort((a, b) => a.trip - b.trip)[0]
        return {
          started: current.settings.routeStarted,
          revision: current.settings.routeRevision,
          stops: current.stops.filter(
            (stop) =>
              load &&
              (stop.loadId === load.id ||
                isAssignedStop(stop, current.orders, load) ||
                (!stop.loadId && load.items.some((item) => item.outlet === stop.outlet))),
          ),
        }
      },
      listStops: async (filter = {}) =>
        (await snapshot()).stops.filter(
          (stop) => !filter.outletId || stop.outlet === filter.outletId,
        ),
      startRoute: () => service.startRoute(),
      arrive: (stopId) => service.arrive(stopId),
      saveProof: (stopId, proof) =>
        service.saveDeliveryProof(
          stopId,
          proof.photo,
          proof.quantity,
          proof.receiver,
          proof.exception,
          proof.signature,
          proof.capturedRevision,
          proof.managerSignOff,
        ),
      confirmManagerHandoff: (outletId, stopId, proof) =>
        service.confirmManagerHandoff(outletId, stopId, proof),
      reportIssue: (stopId, issue) => service.reportDeliveryIssue(stopId, issue),
      reportDelay: (stopId, note, revisedEta, kind) =>
        service.reportDelay(stopId, note, revisedEta, kind),
      listRouteHistory: async () => {
        const current = await snapshot()
        const load = assignedDriverLoad(current)
        return (current.routeEvents ?? []).filter((event) => event.vehicleId === load?.vehicleId)
      },
      saveAttemptProof: (stopId, photo, issue) => service.saveAttemptProof(stopId, photo, issue),
      retryStop: (stopId) => service.retryStop(stopId),
      reopenProofForSignOff: (actionId) => service.reopenProofForSignOff(actionId),
      getEvidence: (evidenceId) => service.repository.getEvidence(evidenceId),
      getProofDraft: (stopId) => service.repository.getProofDraft(stopId),
      listProofDrafts: () => service.repository.listProofDrafts(),
      saveProofDraft: (draft) => service.saveProofDraft(draft),
      deleteProofDraft: (stopId) => service.repository.deleteProofDraft(stopId),
      listQueue: async () => (await snapshot()).queue,
      sync: (isOnline, options) => service.sync(isOnline, options?.retryFailed ?? true),
      reviewQueuedRecord: (actionId) => service.reviewQueuedRecord(actionId),
    },
    fleet: {
      listVehicles: async () => (await snapshot()).vehicles,
      getVehicle: async (vehicleId) =>
        (await snapshot()).vehicles.find((vehicle) => vehicle.id === vehicleId),
      createVehicle: (input) => service.createVehicle(input),
    },
    team: {
      listMembers: async () => (await snapshot()).members,
      listAudit: async () => (await snapshot()).audit,
      getSummary: async () => {
        const { members, unlistedTeamCounts, audit, unlistedAuditCount } = await snapshot()
        const count = (status: 'Active' | 'Invited' | 'Suspended') =>
          members.filter((member) => member.status === status).length +
          (unlistedTeamCounts?.[status] ?? 0)
        const [active, invited, suspended] = [count('Active'), count('Invited'), count('Suspended')]
        return {
          total: active + invited + suspended,
          active,
          invited,
          suspended,
          auditEvents: audit.length + (unlistedAuditCount ?? 0),
        }
      },
      listActivity: async (memberId) => {
        const { audit, members } = await snapshot()
        const own = audit
          .filter((entry) => entry.recordId === memberId)
          .map((entry) => ({
            when:
              entry.referenceWhen ??
              new Date(entry.at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            title: entry.action,
            detail: entry.detail,
          }))
        return [...own, ...(memberActivityReference[memberId] ?? [])].length
          ? [...own, ...(memberActivityReference[memberId] ?? [])]
          : members.some((member) => member.id === memberId)
            ? []
            : []
      },
      invite: (name, email, role) => service.invite(name, email, role),
      inviteByMobile: (invitation) => service.inviteByMobile(invitation),
      createUser: (user) => service.createUser(user),
      completeInvitation: (memberId) => service.completeInvitation(memberId),
      resetAccess: (memberId, password) => service.resetAccess(memberId, password),
      updateContact: (memberId, contact) => service.updateMemberContact(memberId, contact),
      requestAccountChange: (memberId, detail) => service.requestAccountChange(memberId, detail),
      changeAssignment: (memberId, depot, assignment) =>
        service.changeAssignment(memberId, depot, assignment),
      reassignTrip: (fromMemberId, toMemberId) => service.reassignTrip(fromMemberId, toMemberId),
      updateRole: (memberId, role) => service.updateMember(memberId, role),
      suspend: (memberId, scheduled, reason) => service.suspend(memberId, scheduled, reason),
    },
    account: {
      getSettings: async () => (await snapshot()).settings,
      updateSettings: (values) => service.updateSettings(values),
      saveProfilePhoto: (file) => service.saveProfilePhoto(file),
    },
  }
}
