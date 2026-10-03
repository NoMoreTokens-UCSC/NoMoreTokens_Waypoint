/**
 * HTTP implementations of all domain API contracts.
 *
 * Each section maps the domain interface (e.g. OrdersApi) to real
 * backend HTTP calls. The local IndexedDB adapters remain as fallback.
 *
 * Status-to-model mappers convert backend snake_case enums to the
 * frontend's PascalCase domain values without touching any screen code.
 */

import type { Apis } from '../../domain/api'
import type { OrdersApi, ReceiptIssue } from '../../domain/api/orders'
import type { PlanningApi } from '../../domain/api/planning'
import type { LoadingApi } from '../../domain/api/loading'
import type { DeliveryApi } from '../../domain/api/delivery'
import type { FleetApi } from '../../domain/api/fleet'
import type { Order, OrderStatus, Stop, Trip, Vehicle, Load } from '../../domain/models'
import { request } from './apiClient'

// ── Status mappers ─────────────────────────────────────────────────────────

function mapOrderStatus(s: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    PLACED: 'Confirmed',
    CONFIRMED: 'Confirmed',
    QUEUED: 'Confirmed',
    PLANNED: 'Allocated',
    LOADED: 'Allocated',
    IN_TRANSIT: 'En route',
    DELIVERED: 'Delivered',
    PARTIAL: 'Delivered',
    FAILED: 'En route',
    DEFERRED: 'Deferred',
    CANCELLED: 'Deferred',
  }
  return (map[s] ?? 'Confirmed') as OrderStatus
}

function mapOrder(o: ApiOrder): Order {
  return {
    id: String(o.id),
    outlet: o.outlet_id,
    outletName: o.outlet_id,   // enriched by reference data if needed
    brand: o.brand as Order['brand'],
    window: o.window_open ?? '05:00',
    windowEnd: o.window_close ?? '07:30',
    volume: o.total_volume,
    weight: o.total_weight,
    temperature: o.temperature_class === 'AMBIENT' ? 'Ambient' : 'Chilled',
    cases: o.total_cases ?? 0,
    status: mapOrderStatus(o.status),
    priority: o.priority,
    vehicleId: o.vehicle_id,
    receipt: 'Pending',
    placedAt: o.created_at,
  }
}

function mapStop(s: ApiStop): Stop {
  const statusMap: Record<string, Stop['status']> = {
    PENDING: 'Upcoming',
    ARRIVED: 'Arrived',
    COMPLETED: 'Delivered',
    PARTIAL: 'Delivered',
    FAILED: 'Cannot deliver',
  }
  return {
    id: String(s.id),
    outlet: s.outlet_id,
    name: s.outlet_id,
    address: s.district ?? '',
    window: s.window_open ?? '05:00',
    eta: s.planned_eta ?? '',
    lat: s.lat ?? 0,
    lng: s.lng ?? 0,
    orderIds: (s.order_ids ?? []).map(String),
    cases: s.total_cases ?? 0,
    status: (statusMap[s.status] ?? 'Upcoming') as Stop['status'],
  }
}

function mapTrip(t: ApiTrip): Trip {
  const statusMap: Record<string, Trip['status']> = {
    PLANNED: 'Planned',
    LOADING: 'Planned',
    LOADED: 'Scheduled',
    IN_TRANSIT: 'En route',
    COMPLETED: 'Complete',
    CANCELLED: 'Complete',
  }
  return {
    id: String(t.id),
    vehicleId: t.vehicle_id,
    number: t.trip_number,
    orderIds: [],
    weight: t.planned_weight ?? 0,
    volume: t.planned_volume ?? 0,
    cases: 0,
    status: (statusMap[t.status] ?? 'Planned') as Trip['status'],
  }
}

// ── Backend response shapes (minimal) ──────────────────────────────────────

interface ApiOrder {
  id: number
  outlet_id: string
  brand: string
  temperature_class: string
  total_weight: number
  total_volume: number
  total_cases?: number
  status: string
  priority: boolean
  vehicle_id?: string
  window_open?: string
  window_close?: string
  created_at?: string
}

interface ApiStop {
  id: number
  outlet_id: string
  district?: string
  status: string
  planned_eta?: string
  window_open?: string
  lat?: number
  lng?: number
  order_ids?: number[]
  total_cases?: number
}

interface ApiTrip {
  id: number
  vehicle_id: string
  trip_number: number
  status: string
  planned_weight?: number
  planned_volume?: number
  planned_distance?: number
  planned_fuel?: number
}

interface ApiPlan {
  id: number
  delivery_date: string
  status: string
  trips: ApiTrip[]
  summary_json?: Record<string, unknown>
}

// ── Orders HTTP adapter ────────────────────────────────────────────────────

function createHttpOrdersApi(outletId?: string): OrdersApi {
  return {
    async listOrders(filter = {}) {
      const params = new URLSearchParams()
      const scope = filter.outletId ?? outletId
      if (scope) params.set('outlet_id', scope)
      if (filter.status) params.set('status', filter.status.toUpperCase())
      const orders = await request<ApiOrder[]>(`/orders?${params}`)
      return orders.map(mapOrder)
    },

    async listDrafts() {
      return []   // drafts are device-local; backend has no draft concept
    },

    async getIntakeStatus() {
      const data = await request<{ past_cutoff: boolean; has_published_plan: boolean }>(
        '/orders/close',
      ).catch(() => ({ past_cutoff: false, has_published_plan: false }))
      return {
        cutoffClosed: data.past_cutoff,
        published: data.has_published_plan,
      }
    },

    async createOrder(outlet, temperature, cases, window) {
      await request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          outlet_id: outlet,
          temperature_class: temperature === 'Chilled' ? 'CHILLED' : 'AMBIENT',
          cases,
          window_open: window,
        }),
      })
    },

    async placeOrders(outlet, inputs) {
      for (const inp of inputs) {
        await request('/orders', {
          method: 'POST',
          body: JSON.stringify({
            outlet_id: outlet,
            temperature_class: inp.temperature === 'Chilled' ? 'CHILLED' : 'AMBIENT',
            cases: inp.cases,
            total_weight: inp.weight,
            total_volume: inp.volume,
            window_open: inp.window,
            window_close: inp.windowEnd,
          }),
        })
      }
    },

    async editOrder(orderId, cases, window) {
      await request(`/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ cases, window_open: window }),
      })
    },

    saveDraft: async () => {},          // device-only
    saveDrafts: async () => {},         // device-only

    async confirmReceipt(orderId) {
      await request(`/orders/${orderId}/receipt`, {
        method: 'POST',
        body: JSON.stringify({ outcome: 'FULL' }),
      })
    },

    async reportReceiptIssue(orderId, issue: ReceiptIssue) {
      await request(`/orders/${orderId}/receipt`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: issue.kind === 'Missing' ? 'SHORT' : 'DAMAGED',
          received_qty: issue.received,
          affected_qty: issue.affected,
          notes: issue.description,
        }),
      })
    },

    async acknowledgeDeferral(orderId) {
      // Record acknowledgement as a note
      await request(`/orders/${orderId}/issues`, {
        method: 'POST',
        body: JSON.stringify({ type: 'OTHER', description: 'Deferral acknowledged by store manager.' }),
      }).catch(() => {})
    },
  }
}

// ── Planning HTTP adapter ──────────────────────────────────────────────────

function createHttpPlanningApi(): PlanningApi {
  return {
    async getPlan() {
      const [plans, intakeResp] = await Promise.all([
        request<ApiPlan[]>('/plans?status=PUBLISHED').catch(() =>
          request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[]),
        ),
        request<{ past_cutoff: boolean; has_published_plan: boolean }>('/orders/close').catch(
          () => ({ past_cutoff: false, has_published_plan: false }),
        ),
      ])

      const plan = plans[0]
      const trips = plan?.trips.map(mapTrip) ?? []
      const orders = plan
        ? await request<ApiOrder[]>(`/orders?delivery_date=${plan.delivery_date}`).then((os) =>
            os.map(mapOrder),
          )
        : []

      return {
        orders,
        trips,
        status: {
          cutoffClosed: intakeResp.past_cutoff,
          published: intakeResp.has_published_plan,
          allocationReviewed: plan?.status === 'PUBLISHED',
        },
      }
    },

    async autoAllocate() {
      await request('/plans/auto-plan', { method: 'POST' })
    },

    async allocate(orderId, vehicleId, trip) {
      // Find the published/draft plan and move the order
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      const plan = plans[0]
      if (!plan) throw new Error('No draft plan to edit')
      const targetTrip = plan.trips.find(
        (t) => t.vehicle_id === vehicleId && t.trip_number === trip,
      )
      if (!targetTrip) throw new Error('Trip not found')
      await request(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ moves: [{ order_id: Number(orderId), to_trip_id: targetTrip.id }] }),
      })
    },

    async unallocate(_orderId) {
      // Removing from plan: not yet in backend scope — noop
    },

    async defer(orderId, reason) {
      await request(`/deferrals`, {
        method: 'POST',
        body: JSON.stringify({ order_id: Number(orderId), reason_code: reason }),
      }).catch(() => {})
    },

    async reviewAllocation() {
      // Treated as a local-only state in demo; noop in backend
    },

    async publish() {
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      const plan = plans[0]
      if (!plan) throw new Error('No draft plan to publish')
      await request(`/plans/${plan.id}/publish`, { method: 'POST' })
    },

    async release(loadId) {
      await request(`/loading/trips/${loadId}/release`, { method: 'POST' })
    },
  }
}

// ── Loading HTTP adapter ───────────────────────────────────────────────────

function createHttpLoadingApi(): LoadingApi {
  return {
    async listLoads() {
      const trips = await request<ApiTrip[]>('/loading/trips').catch(() => [] as ApiTrip[])
      return trips.map(
        (t): Load => ({
          id: String(t.id),
          vehicleId: t.vehicle_id,
          trip: t.trip_number,
          revision: 1,
          bay: '',
          items: [],
          checks: { refrigeration: false, condition: false, restraints: false },
          issueResolved: false,
          completed: t.status === 'LOADED' || t.status === 'IN_TRANSIT',
          released: t.status === 'IN_TRANSIT' || t.status === 'COMPLETED',
        }),
      )
    },

    async getLoad(loadId) {
      const trip = await request<ApiTrip>(`/loading/trips/${loadId}`).catch(() => null)
      if (!trip) return undefined
      return {
        id: String(trip.id),
        vehicleId: trip.vehicle_id,
        trip: trip.trip_number,
        revision: 1,
        bay: '',
        items: [],
        checks: { refrigeration: false, condition: false, restraints: false },
        issueResolved: false,
        completed: trip.status === 'LOADED',
        released: trip.status === 'IN_TRANSIT',
      }
    },

    async setLoaded(loadId, outlet, quantity) {
      await request(`/loading/trips/${loadId}/flags`, {
        method: 'POST',
        body: JSON.stringify({ outlet_id: outlet, flag: 'OK', quantity }),
      })
    },

    async setCheck(_loadId, _check, _checked) {
      // Checks are stored in load_checks; no dedicated endpoint for boolean checks yet
    },

    async reportIssue(loadId, issue) {
      await request(`/loading/trips/${loadId}/flags`, {
        method: 'POST',
        body: JSON.stringify({ flag: 'DAMAGED', notes: issue }),
      })
    },

    async resolveIssue(_loadId) {},

    async attachPhoto(loadId, file) {
      const form = new FormData()
      form.append('file', file)
      form.append('stop_id', loadId)
      await request('/driver/uploads', { method: 'POST', body: form })
    },

    async complete(loadId) {
      await request(`/loading/trips/${loadId}/release`, { method: 'POST' })
    },
  }
}

// ── Delivery HTTP adapter ──────────────────────────────────────────────────

function createHttpDeliveryApi(): DeliveryApi {
  return {
    async getRoute() {
      const resp = await request<{
        trip: ApiTrip
        stops: ApiStop[]
        started: boolean
        revision: number
      }>('/driver/trips/current').catch(() => null)
      return {
        started: resp?.started ?? false,
        revision: resp?.revision ?? 0,
        stops: (resp?.stops ?? []).map(mapStop),
      }
    },

    async listStops(filter = {}) {
      const resp = await request<{ stops: ApiStop[] }>('/driver/trips/current').catch(
        () => ({ stops: [] }),
      )
      return (resp.stops ?? [])
        .map(mapStop)
        .filter((s) => !filter.outletId || s.outlet === filter.outletId)
    },

    async startRoute() {
      // Starting the route is implicit when the first delivery event is synced
    },

    async arrive(stopId) {
      const id = crypto.randomUUID()
      await request('/driver/sync', {
        method: 'POST',
        body: JSON.stringify({
          events: [{ client_op_id: id, stop_id: Number(stopId), outcome: 'ARRIVED' }],
        }),
      })
    },

    async saveProof(stopId, proof) {
      const id = crypto.randomUUID()
      const form = new FormData()
      if (proof.photo) form.append('file', proof.photo)
      form.append('stop_id', stopId)
      const uploadResp = await request<{ photo_url: string }>('/driver/uploads', {
        method: 'POST',
        body: form,
      }).catch(() => ({ photo_url: '' }))

      await request('/driver/sync', {
        method: 'POST',
        body: JSON.stringify({
          events: [
            {
              client_op_id: id,
              stop_id: Number(stopId),
              outcome: 'DELIVERED',
              receiver_name: proof.receiver,
              delivered_qty: proof.quantity,
              receiver_exception: proof.exception || null,
              photo_url: uploadResp.photo_url,
            },
          ],
        }),
      })
    },

    async reportIssue(stopId, issue) {
      const id = crypto.randomUUID()
      await request('/driver/sync', {
        method: 'POST',
        body: JSON.stringify({
          events: [{ client_op_id: id, stop_id: Number(stopId), outcome: 'FAILED', notes: issue }],
        }),
      })
    },

    async saveAttemptProof(stopId, photo, issue) {
      const id = crypto.randomUUID()
      const form = new FormData()
      form.append('file', photo)
      form.append('stop_id', stopId)
      await request('/driver/uploads', { method: 'POST', body: form }).catch(() => {})

      await request('/driver/sync', {
        method: 'POST',
        body: JSON.stringify({
          events: [{ client_op_id: id, stop_id: Number(stopId), outcome: 'FAILED', notes: issue }],
        }),
      })
    },

    async retryStop(stopId) {
      const id = crypto.randomUUID()
      await request('/driver/sync', {
        method: 'POST',
        body: JSON.stringify({
          events: [{ client_op_id: id, stop_id: Number(stopId), outcome: 'RETRY' }],
        }),
      })
    },

    // Evidence and queue remain device-local (IndexedDB via Dexie)
    async getEvidence(_id) { return undefined },
    async listQueue() { return [] },
    async sync(_isOnline) {},
    async reviewQueuedRecord(_id) {},
  }
}

// ── Fleet HTTP adapter ─────────────────────────────────────────────────────

function createHttpFleetApi(): FleetApi {
  return {
    async listVehicles() {
      const vehicles = await request<Array<{
        vehicle_id: string
        type: string
        is_refrigerated: boolean
        weight_cap_kg: number
        volume_cap_m3: number
        brand?: string
        status?: string
        lat?: number
        lng?: number
      }>>('/reference/vehicles').catch(() => [])
      return vehicles.map(
        (v): Vehicle => ({
          id: v.vehicle_id,
          brand: 'Fresh',
          type: v.type === 'van' ? 'Van' : 'Truck',
          reefer: v.is_refrigerated,
          weightCapacity: v.weight_cap_kg,
          volumeCapacity: v.volume_cap_m3,
          status: 'Available',
          location: '',
          lat: v.lat ?? 0,
          lng: v.lng ?? 0,
          updatedMinutes: 0,
        }),
      )
    },

    async getVehicle(vehicleId) {
      const v = await request<{
        vehicle_id: string
        type: string
        is_refrigerated: boolean
        weight_cap_kg: number
        volume_cap_m3: number
        lat?: number
        lng?: number
      }>(`/reference/vehicles/${vehicleId}`).catch(() => null)
      if (!v) return undefined
      return {
        id: v.vehicle_id,
        brand: 'Fresh',
        type: v.type === 'van' ? 'Van' : 'Truck',
        reefer: v.is_refrigerated,
        weightCapacity: v.weight_cap_kg,
        volumeCapacity: v.volume_cap_m3,
        status: 'Available',
        location: '',
        lat: v.lat ?? 0,
        lng: v.lng ?? 0,
        updatedMinutes: 0,
      }
    },
  }
}

// ── Stub adapters for team/account (remain local until Phase n) ─────────────

function createStubTeamApi() {
  return {
    listMembers: async () => [],
    listAudit: async () => [],
    invite: async () => {},
    inviteByMobile: async () => {},
    completeInvitation: async () => {},
    resetAccess: async () => {},
    requestAccountChange: async () => {},
    changeAssignment: async () => {},
    reassignTrip: async () => {},
    updateRole: async () => {},
    suspend: async () => {},
  }
}

function createStubAccountApi() {
  return {
    getSettings: async () => ({
      cutoffClosed: false,
      published: false,
      routeStarted: false,
      routeRevision: 0,
      simulatedOffline: false,
      syncOutcome: 'accepted' as const,
      profileName: 'Demo User',
      profilePhone: '',
      notifications: true,
      compactRows: false,
    }),
    updateSettings: async () => {},
    saveProfilePhoto: async () => {},
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create the full HTTP-backed Apis implementation.
 * `outletId` scopes store manager queries to their outlet.
 */
export function createHttpApis(outletId?: string): Apis {
  return {
    orders: createHttpOrdersApi(outletId),
    planning: createHttpPlanningApi(),
    loading: createHttpLoadingApi(),
    delivery: createHttpDeliveryApi(),
    fleet: createHttpFleetApi(),
    team: createStubTeamApi() as Apis['team'],
    account: createStubAccountApi() as Apis['account'],
  }
}
