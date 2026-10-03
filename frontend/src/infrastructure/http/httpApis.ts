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
import { outletProfiles, profileOf, type OutletProfile } from '../../domain/outlets'
import { request } from './apiClient'
import { WaypointDatabase } from '../persistence/database'

const localDb = new WaypointDatabase()

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
  const etaText = s.planned_eta
    ? new Date(s.planned_eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
  return {
    id: String(s.id),
    outlet: s.outlet_id,
    name: s.outlet_id,
    address: s.district ?? '',
    window: s.window_open ?? '05:00',
    eta: etaText,
    lat: s.lat ?? 0,
    lng: s.lng ?? 0,
    orderIds: (s.order_ids ?? []).map(String),
    cases: s.total_cases ?? 0,
    status: (statusMap[s.status] ?? 'Upcoming') as Stop['status'],
    proofId: s.proof_id,
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
  sequence?: number
  district?: string
  status: string
  planned_eta?: string
  window_open?: string
  lat?: number
  lng?: number
  order_ids?: number[]
  total_cases?: number
  proof_id?: string
}

interface ApiTrip {
  id: number
  plan_id?: number
  vehicle_id: string
  trip_number: number
  status: string
  planned_depart?: string
  planned_return?: string
  planned_weight?: number
  planned_volume?: number
  planned_distance?: number
  planned_fuel?: number
  stops?: ApiStop[]
  photo_path?: string
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
      const data = await request<{ cutoff_closed: boolean; published: boolean }>(
        '/orders/intake-status',
      ).catch(() => ({ cutoff_closed: false, published: true }))
      return {
        cutoffClosed: data.cutoff_closed,
        published: data.published,
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

    async listHistory(filter = {}) {
      const params = new URLSearchParams()
      const scope = filter.outletId ?? outletId
      if (scope) params.set('outlet_id', scope)
      const orders = await request<ApiOrder[]>(`/orders?${params.toString()}`).catch(() => [] as ApiOrder[])
      return orders.map(mapOrder).sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''))
    },

    async getOutletProfile(id: string): Promise<OutletProfile> {
      return profileOf(id) ?? outletProfiles[0]!
    },

    async cancelOrder(orderId) {
      await request(`/orders/${orderId}/cancel`, { method: 'POST' })
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

function mapTripToLoad(trip: ApiTrip, depot?: string): Load {
  let localData: {
    loadedCounts?: Record<string, number>
    checks?: { refrigeration: boolean; condition: boolean; restraints: boolean }
    issue?: string
    photoId?: string
    acknowledgedRevision?: number
  } = {}
  try {
    const raw = localStorage.getItem(`waypoint.load.${trip.id}`)
    if (raw) localData = JSON.parse(raw)
  } catch {}

  const stops = trip.stops ?? []
  const isLoaded = trip.status === 'LOADED' || trip.status === 'IN_TRANSIT' || trip.status === 'COMPLETED'
  const isReleased = trip.status === 'LOADED' || trip.status === 'IN_TRANSIT' || trip.status === 'COMPLETED'

  // Items ordered by reverse sequence for rear-to-front loading
  const items = stops
    .map((s, idx) => {
      const expected = s.total_cases && s.total_cases > 0 ? s.total_cases : 15
      const loadedCount = localData.loadedCounts?.[s.outlet_id] ?? (isLoaded ? expected : 0)
      return {
        outlet: s.outlet_id,
        name: s.outlet_id,
        expected,
        loaded: loadedCount,
        stop: s.sequence ?? idx + 1,
      }
    })
    .sort((a, b) => b.stop - a.stop)

    const serverOrigin = (
      import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
    ).replace(/\/api\/v1\/?$/, '')

    return {
      id: String(trip.id),
      vehicleId: trip.vehicle_id,
      trip: trip.trip_number,
      revision: 1,
      bay: `Bay ${(trip.trip_number % 8) + 1}`,
      depot: depot ?? 'Peliyagoda',
      departureTime: trip.planned_depart
        ? new Date(trip.planned_depart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined,
      acknowledgedRevision: localData.acknowledgedRevision,
      items,
      checks: localData.checks ?? {
        refrigeration: isLoaded,
        condition: isLoaded,
        restraints: isLoaded,
      },
      issue: localData.issue,
      issueResolved: !localData.issue,
      photoId: localData.photoId ?? (trip.photo_path ? `${serverOrigin}${trip.photo_path}` : undefined),
      completed: isLoaded,
      released: isReleased,
    }
  }

function createHttpLoadingApi(): LoadingApi {
  return {
    async listLoads(filter = {}) {
      const params = new URLSearchParams()
      if (filter.depot) params.set('depot', filter.depot)
      const query = params.toString() ? `?${params}` : ''
      const trips = await request<ApiTrip[]>(`/loading/trips${query}`).catch(() => [] as ApiTrip[])
      return trips.map((t) => mapTripToLoad(t, filter.depot))
    },

    async getLoad(loadId) {
      const trip = await request<ApiTrip>(`/loading/trips/${loadId}`).catch(() => null)
      if (!trip) return undefined
      return mapTripToLoad(trip)
    },

    async getWorkspace(loadId, depot) {
      const trip = await request<ApiTrip>(`/loading/trips/${loadId}`).catch(() => null)
      if (!trip) return undefined

      let vehicle: Vehicle = {
        id: trip.vehicle_id,
        brand: 'Fresh',
        type: 'Truck',
        reefer: true,
        weightCapacity: 5000,
        volumeCapacity: 25,
        status: 'Loading',
        location: depot ?? 'Peliyagoda',
        lat: 6.96,
        lng: 79.90,
        updatedMinutes: 0,
      }
      try {
        const v = await request<{
          vehicle_id: string
          depot_code: string
          type: string
          is_refrigerated: boolean
          weight_cap_kg: number
          volume_cap_m3: number
        }>(`/reference/vehicles/${trip.vehicle_id}`)
        if (v) {
          vehicle = {
            id: v.vehicle_id,
            brand: 'Fresh',
            type: v.type?.toLowerCase() === 'van' ? 'Van' : 'Truck',
            reefer: v.is_refrigerated,
            weightCapacity: v.weight_cap_kg,
            volumeCapacity: v.volume_cap_m3,
            status: 'Loading',
            location: v.depot_code,
            lat: 6.96,
            lng: 79.90,
            updatedMinutes: 0,
          }
        }
      } catch {}

      const load = mapTripToLoad(trip, depot)
      const stops: Stop[] = (trip.stops ?? []).map(mapStop)
      return {
        load,
        vehicle,
        published: true,
        stops,
        weight: trip.planned_weight ?? 1200,
        volume: trip.planned_volume ?? 8.5,
      }
    },

    async acknowledgeRevision(loadId, expectedRevision) {
      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        current.acknowledgedRevision = expectedRevision
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}
    },

    async setLoaded(loadId, outlet, quantity) {
      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        current.loadedCounts = { ...(current.loadedCounts || {}), [outlet]: quantity }
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}

      await request(`/loading/trips/${loadId}/flags`, {
        method: 'POST',
        body: JSON.stringify({ status: 'OK', note: `Loaded ${quantity} cases for ${outlet}` }),
      }).catch(() => {})
    },

    async setCheck(loadId, check, checked) {
      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        current.checks = { ...(current.checks || {}), [check]: checked }
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}
    },

    async reportIssue(loadId, issue) {
      const desc =
        typeof issue === 'string'
          ? issue
          : `${issue.kind}: ${issue.description || ''} (${issue.affectedCases} cases at ${issue.outlet})`
      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        current.issue = desc
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}

      await request(`/loading/trips/${loadId}/flags`, {
        method: 'POST',
        body: JSON.stringify({ status: 'DAMAGED', note: desc }),
      }).catch(() => {})
    },

    async resolveIssue(loadId) {
      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        delete current.issue
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}
    },

    async attachPhoto(loadId, file) {
      const form = new FormData()
      form.append('file', file)
      form.append('stop_id', loadId)
      const res = await request<{ path: string }>('/driver/uploads', {
        method: 'POST',
        body: form,
      }).catch(() => null)

      const serverOrigin = (
        import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
      ).replace(/\/api\/v1\/?$/, '')

      const photoUrl = res?.path ? `${serverOrigin}${res.path}` : URL.createObjectURL(file)

      try {
        const key = `waypoint.load.${loadId}`
        const current = JSON.parse(localStorage.getItem(key) || '{}')
        current.photoId = photoUrl
        localStorage.setItem(key, JSON.stringify(current))
      } catch {}

      if (res?.path) {
        await request(`/loading/trips/${loadId}/flags`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'OK',
            note: 'Loading proof photograph uploaded',
            photo_path: res.path,
          }),
        }).catch(() => {})
      }
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
      const resp = await request<ApiTrip>('/driver/trips/current').catch(() => null)
      if (!resp) {
        return {
          started: false,
          revision: 0,
          stops: [],
        }
      }
      return {
        started: resp.status === 'IN_TRANSIT' || resp.status === 'COMPLETED',
        revision: 1,
        stops: (resp.stops ?? []).map(mapStop),
      }
    },

    async listStops(filter = {}) {
      const resp = await request<ApiTrip>('/driver/trips/current').catch(() => null)
      return (resp?.stops ?? [])
        .map(mapStop)
        .filter((s) => !filter.outletId || s.outlet === filter.outletId)
    },

    async startRoute() {
      await request('/driver/trips/start', { method: 'POST' }).catch(() => {})
    },

    async arrive(stopId) {
      const id = crypto.randomUUID()
      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'ARRIVED',
        }),
      })
    },

    async saveProof(stopId, proof) {
      const id = crypto.randomUUID()
      let photoUrl = ''
      if (proof.photo) {
        const form = new FormData()
        form.append('file', proof.photo)
        form.append('stop_id', stopId)
        const uploadResp = await request<{ path: string }>('/driver/uploads', {
          method: 'POST',
          body: form,
        }).catch(() => null)
        if (uploadResp?.path) {
          const serverOrigin = (
            import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
          ).replace(/\/api\/v1\/?$/, '')
          photoUrl = `${serverOrigin}${uploadResp.path}`
        }
      }

      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'DELIVERED',
          note: `Delivered ${proof.quantity} cases`,
          pod_photo_path: photoUrl || null,
          receiver_name: proof.receiver || null,
          receiver_pin_ok: true,
        }),
      })

      const evidenceId = photoUrl || id
      await localDb.evidence
        .put({
          id: evidenceId,
          kind: 'delivery',
          entityId: stopId,
          photo: proof.photo,
          fileName: proof.photo?.name ?? 'delivery-proof.jpg',
          createdAt: new Date().toISOString(),
          quantity: proof.quantity,
          receiver: proof.receiver,
          signature: proof.signature,
          managerSignOff: proof.managerSignOff,
          receiverException: proof.exception,
          revision: proof.capturedRevision ?? 1,
          accepted: true,
        })
        .catch(() => {})

      await localDb.driverProofDrafts.delete(stopId).catch(() => {})
    },

    async reportIssue(stopId, issue) {
      const id = crypto.randomUUID()
      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'FAILED',
          note: issue,
        }),
      })
    },

    async saveAttemptProof(stopId, photo, issue) {
      const id = crypto.randomUUID()
      let photoUrl = ''
      if (photo) {
        const form = new FormData()
        form.append('file', photo)
        form.append('stop_id', stopId)
        const uploadResp = await request<{ path: string }>('/driver/uploads', {
          method: 'POST',
          body: form,
        }).catch(() => null)
        if (uploadResp?.path) {
          const serverOrigin = (
            import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
          ).replace(/\/api\/v1\/?$/, '')
          photoUrl = `${serverOrigin}${uploadResp.path}`
        }
      }

      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'FAILED',
          note: photoUrl ? `${issue} | Proof: ${photoUrl}` : issue,
        }),
      })
    },

    async retryStop(stopId) {
      const id = crypto.randomUUID()
      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'ARRIVED',
          note: 'Retry stop',
        }),
      })
    },

    async confirmManagerHandoff(_outletId, stopId, proof) {
      await this.saveProof(stopId, proof)
    },

    async reportDelay(stopId, note, revisedEta, kind) {
      const id = crypto.randomUUID()
      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: id,
          stop_id: Number(stopId),
          outcome: 'PARTIAL',
          note: `${kind ?? 'delay'}: ${note}${revisedEta ? ` (ETA: ${revisedEta})` : ''}`,
        }),
      }).catch(() => {})
    },

    async listRouteHistory() {
      return []
    },

    async reopenProofForSignOff(_actionId) {},

    async getProofDraft(stopId) {
      return localDb.driverProofDrafts.get(stopId)
    },

    async listProofDrafts() {
      return localDb.driverProofDrafts.toArray()
    },

    async saveProofDraft(draft) {
      await localDb.driverProofDrafts.put(draft)
    },

    async deleteProofDraft(stopId) {
      await localDb.driverProofDrafts.delete(stopId)
    },

    async getEvidence(id) {
      const found = await localDb.evidence.get(id)
      if (found) return found
      if (id && (id.startsWith('http') || id.startsWith('/uploads'))) {
        try {
          const url = id.startsWith('http')
            ? id
            : `${(import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '')}${id}`
          const res = await fetch(url)
          if (res.ok) {
            const blob = await res.blob()
            const synthetic = {
              id,
              kind: 'delivery' as const,
              entityId: '',
              photo: blob,
              fileName: id.split('/').pop() || 'proof.jpg',
              createdAt: new Date().toISOString(),
              revision: 1,
              accepted: true,
            }
            await localDb.evidence.put(synthetic).catch(() => {})
            return synthetic
          }
        } catch {
          // ignore
        }
      }
      return undefined
    },

    async listQueue() {
      return localDb.queue.toArray()
    },

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
    updateContact: async () => {},
    requestAccountChange: async () => {},
    changeAssignment: async () => {},
    reassignTrip: async () => {},
    updateRole: async () => {},
    suspend: async () => {},
  }
}

function createStubDriverSignalsApi() {
  return {
    registerPushSubscription: async () => {},
    recordPosition: async () => {},
    pendingPositions: async () => [],
    listNotices: async () => [],
    acknowledgeNotice: async () => {},
    checkDeliveryWindows: async () => [],
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
    driverSignals: createStubDriverSignalsApi() as unknown as Apis['driverSignals'],
    orders: createHttpOrdersApi(outletId),
    planning: createHttpPlanningApi(),
    loading: createHttpLoadingApi(),
    delivery: createHttpDeliveryApi(),
    fleet: createHttpFleetApi(),
    team: createStubTeamApi() as unknown as Apis['team'],
    account: createStubAccountApi() as unknown as Apis['account'],
  }
}
