import type { Apis } from '../../domain/api'
import { tripsFromOrders } from '../../domain/trips'
import type { OperationsService } from '../../application/OperationsService'

/** The local demo models a single store workspace; a backend scopes every outlet. */
const demoOutlet = 'OUT001'
function requireDemoOutlet(outletId: string) {
  if (outletId !== demoOutlet)
    throw new Error(`The local demo places orders for ${demoOutlet} only.`)
}

/**
 * Implements the API contract in the browser over IndexedDB, through the existing
 * OperationsService. Replace these with HTTP adapters in src/app/apis.ts; screens using
 * useApis() keep working unchanged.
 */
export function createLocalApis(service: OperationsService): Apis {
  const snapshot = () => service.repository.getSnapshot()
  return {
    orders: {
      listOrders: async (filter = {}) =>
        (await snapshot()).orders.filter(
          (order) =>
            (!filter.outletId || order.outlet === filter.outletId) &&
            (!filter.status || order.status === filter.status),
        ),
      listDrafts: async () => (await snapshot()).drafts,
      getIntakeStatus: async () => {
        const { cutoffClosed, published } = (await snapshot()).settings
        return { cutoffClosed, published }
      },
      createOrder: async (outletId, temperature, cases, window) => {
        requireDemoOutlet(outletId)
        await service.createOrder(temperature, cases, window)
      },
      placeOrders: async (outletId, inputs) => {
        requireDemoOutlet(outletId)
        await service.confirmStoreOrders(inputs)
      },
      editOrder: (orderId, cases, window) => service.editOrder(orderId, cases, window),
      saveDraft: (temperature, cases, window) => service.saveDraft(temperature, cases, window),
      saveDrafts: async (outletId, inputs) => {
        requireDemoOutlet(outletId)
        await service.saveStoreDrafts(inputs)
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
      listLoads: async () => (await snapshot()).loads,
      getLoad: async (loadId) => (await snapshot()).loads.find((load) => load.id === loadId),
      setLoaded: (loadId, outlet, quantity) => service.setLoaded(loadId, outlet, quantity),
      setCheck: (loadId, check, checked) => service.setCheck(loadId, check, checked),
      reportIssue: (loadId, issue) => service.reportLoadIssue(loadId, issue),
      resolveIssue: (loadId) => service.resolveLoadIssue(loadId),
      attachPhoto: (loadId, file) => service.attachLoadingPhoto(loadId, file),
      complete: (loadId) => service.completeLoading(loadId),
    },
    delivery: {
      getRoute: async () => {
        const current = await snapshot()
        return {
          started: current.settings.routeStarted,
          revision: current.settings.routeRevision,
          stops: current.stops,
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
        ),
      reportIssue: (stopId, issue) => service.reportDeliveryIssue(stopId, issue),
      saveAttemptProof: (stopId, photo, issue) => service.saveAttemptProof(stopId, photo, issue),
      retryStop: (stopId) => service.retryStop(stopId),
      getEvidence: (evidenceId) => service.repository.getEvidence(evidenceId),
      listQueue: async () => (await snapshot()).queue,
      sync: (isOnline) => service.sync(isOnline),
      reviewQueuedRecord: (actionId) => service.reviewQueuedRecord(actionId),
    },
    fleet: {
      listVehicles: async () => (await snapshot()).vehicles,
      getVehicle: async (vehicleId) =>
        (await snapshot()).vehicles.find((vehicle) => vehicle.id === vehicleId),
    },
    team: {
      listMembers: async () => (await snapshot()).members,
      listAudit: async () => (await snapshot()).audit,
      invite: (name, email, role) => service.invite(name, email, role),
      inviteByMobile: (invitation) => service.inviteByMobile(invitation),
      completeInvitation: (memberId) => service.completeInvitation(memberId),
      resetAccess: (memberId) => service.resetAccess(memberId),
      requestAccountChange: (memberId, detail) => service.requestAccountChange(memberId, detail),
      changeAssignment: (memberId, depot, assignment) =>
        service.changeAssignment(memberId, depot, assignment),
      reassignTrip: (fromMemberId, toMemberId) => service.reassignTrip(fromMemberId, toMemberId),
      updateRole: (memberId, role) => service.updateMember(memberId, role),
      suspend: (memberId, scheduled) => service.suspend(memberId, scheduled),
    },
    account: {
      getSettings: async () => (await snapshot()).settings,
      updateSettings: (values) => service.updateSettings(values),
      saveProfilePhoto: (file) => service.saveProfilePhoto(file),
    },
  }
}
