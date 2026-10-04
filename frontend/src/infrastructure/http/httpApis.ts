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
import { getUser, request } from './apiClient'
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

/** A vehicle only means "allocated" until the order moves on; delivered and en route orders keep that status. */
function orderStatus(status: string, hasVehicle: boolean, published: boolean): OrderStatus {
  if (status === 'LOADED') return 'Scheduled'
  if (status === 'PLANNED') return published ? 'Scheduled' : 'Allocated'
  const mapped = mapOrderStatus(status)
  return mapped === 'Confirmed' && hasVehicle ? 'Allocated' : mapped
}

function mapReceiptStatus(status?: string): Order['receipt'] {
  if (status === 'FULL') return 'Confirmed'
  if (status === 'PARTIAL' || status === 'DISPUTED') return 'Issue reported'
  return 'Pending'
}

function toBackendReason(reason: string): string {
  const map: Record<string, string> = {
    'Insufficient Volume Capacity': 'VOLUME_CAPACITY',
    'Insufficient Weight Capacity': 'WEIGHT_CAPACITY',
    'No Compatible Temperature Capacity': 'TEMP_MISMATCH',
    'Two-Trip Limit Reached': 'TWO_TRIP_LIMIT',
  }
  return map[reason] ?? reason.slice(0, 30)
}

function toFrontendReason(code?: string): string | undefined {
  if (!code) return undefined
  const map: Record<string, string> = {
    VOLUME_CAPACITY: 'Insufficient Volume Capacity',
    WEIGHT_CAPACITY: 'Insufficient Weight Capacity',
    CAPACITY: 'Insufficient Weight Capacity',
    TEMP_MISMATCH: 'No Compatible Temperature Capacity',
    TWO_TRIP_LIMIT: 'Two-Trip Limit Reached',
    MAX_TRIPS: 'Two-Trip Limit Reached',
    VAN_ONLY: 'Insufficient Volume Capacity',
    FUEL_QUOTA: 'Insufficient Volume Capacity',
  }
  return map[code] ?? code
}

/**
 * `published` is whether the plan for the order's day is published: before that a planned order is only
 * a dispatcher draft, so the store still sees it as waiting for allocation.
 */
function mapOrder(o: ApiOrder, published = false): Order {
  // The backend records a deferral without always changing the status, so a reason with no vehicle counts too.
  const isDeferred = o.status === 'DEFERRED' || (!o.vehicle_id && Boolean(o.deferral_reason))
  const isAllocated = !isDeferred && Boolean(o.vehicle_id)
  return {
    id: String(o.id),
    outlet: o.outlet_id,
    outletName: o.outlet_name ?? o.outlet_id,
    brand: (o.brand as Order['brand']) ?? 'Fresh',
    window: o.window_open ?? '05:00',
    windowEnd: o.window_close ?? '07:30',
    volume: o.total_volume,
    weight: o.total_weight,
    temperature: o.temperature_class === 'AMBIENT' ? 'Ambient' : 'Chilled',
    cases: o.total_cases ?? 0,
    status: isDeferred ? 'Deferred' : orderStatus(o.status, isAllocated, published),
    priority: o.priority,
    vehicleId: o.vehicle_id,
    trip: o.trip,
    deferralReason: toFrontendReason(o.deferral_reason),
    receipt: mapReceiptStatus(o.receipt_status),
    receiptReport: o.receipt_report
      ? {
          kind: o.receipt_report.kind as 'Missing' | 'Damaged',
          received: o.receipt_report.received,
          affected: o.receipt_report.affected,
          description: o.receipt_report.description,
          recordedAt: o.receipt_report.recorded_at ?? new Date().toISOString(),
        }
      : undefined,
    placedAt: o.placed_at ?? o.created_at,
    deliveredAt: o.delivered_at,
    deliveryDate: o.delivery_date,
    cancelledAt: o.status === 'CANCELLED' ? (o.updated_at ?? o.created_at) : undefined,
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
  reference?: string
  outlet_id: string
  outlet_name?: string
  brand: string
  temperature_class: string
  total_weight: number
  total_volume: number
  total_cases?: number
  status: string
  priority: boolean
  vehicle_id?: string
  trip?: number
  deferral_reason?: string
  window_open?: string
  window_close?: string
  receipt_status?: string
  receipt_report?: {
    kind: string
    received: number
    affected: number
    description: string
    recorded_at?: string
  }
  delivered_at?: string
  delivery_date?: string
  placed_at?: string
  created_at?: string
  updated_at?: string
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

/** The day orders are being placed for, and whether its plan is published. */
async function deliveryDay(): Promise<{ date?: string; published?: boolean }> {
  const intake = await request<{ delivery_date?: string; published?: boolean }>(
    '/orders/intake-status',
  ).catch(() => ({}) as { delivery_date?: string; published?: boolean })
  return { date: intake.delivery_date, published: intake.published }
}

function createHttpOrdersApi(outletId?: string): OrdersApi {
  return {
    async listOrders(filter = {}) {
      const params = new URLSearchParams()
      const scope = filter.outletId ?? outletId
      if (scope) params.set('outlet_id', scope)
      if (filter.status) params.set('status', filter.status.toUpperCase())
      const [orders, intake] = await Promise.all([
        request<ApiOrder[]>(`/orders?${params}`),
        filter.outletId ? deliveryDay() : Promise.resolve(undefined),
      ])
      // For one outlet this is the next delivery; its earlier orders come from listHistory.
      return orders
        .filter((o) => !intake?.date || o.delivery_date === intake.date)
        .map((o) => mapOrder(o, intake?.published))
    },

    async listDrafts() {
      return []   // drafts are device-local; backend has no draft concept
    },

    async getIntakeStatus() {
      const data = await request<{
        cutoff_closed: boolean
        published: boolean
        now?: string
        delivery_date?: string
      }>('/orders/intake-status').catch(() => ({ cutoff_closed: false, published: true, now: undefined, delivery_date: undefined }))
      return {
        cutoffClosed: data.cutoff_closed,
        published: data.published,
        now: data.now,
        deliveryDate: data.delivery_date,
      }
    },

    async closeIntake() {
      await request('/orders/close', { method: 'POST' })
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
      // An outlet has one dry and one chilled order per delivery day, so a type it already has is edited.
      const [intake, mine] = await Promise.all([
        request<{ delivery_date?: string }>('/orders/intake-status').catch(
          () => ({}) as { delivery_date?: string },
        ),
        request<ApiOrder[]>('/orders').catch(() => [] as ApiOrder[]),
      ])
      const existingFor = (temperature: string) =>
        mine.find(
          (order) =>
            order.outlet_id === outlet &&
            order.brand === 'Fresh' &&
            order.temperature_class === temperature &&
            order.status !== 'CANCELLED' &&
            (!intake.delivery_date || order.delivery_date === intake.delivery_date),
        )
      for (const input of inputs) {
        const inp = {
          ...input,
          orderId:
            input.orderId ??
            (outlet && input.temperature
              ? existingFor(input.temperature === 'Chilled' ? 'CHILLED' : 'AMBIENT')?.id?.toString()
              : undefined),
        }
        if (inp.orderId) {
          await request(`/orders/${inp.orderId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              cases: inp.cases,
              total_cases: inp.cases,
              total_weight: inp.weight,
              total_volume: inp.volume,
              window_open: inp.window,
              window_close: inp.windowEnd,
            }),
          })
        } else {
          await request('/orders', {
            method: 'POST',
            body: JSON.stringify({
              outlet_id: outlet,
              temperature_class: inp.temperature === 'Chilled' ? 'CHILLED' : 'AMBIENT',
              cases: inp.cases,
              total_cases: inp.cases,
              total_weight: inp.weight,
              total_volume: inp.volume,
              window_open: inp.window,
              window_close: inp.windowEnd,
            }),
          })
        }
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
      const [orders, intake] = await Promise.all([
        request<ApiOrder[]>(`/orders?${params.toString()}`).catch(() => [] as ApiOrder[]),
        deliveryDay(),
      ])
      return orders
        .filter((o) => !intake.date || o.delivery_date !== intake.date)
        .map((o) => mapOrder(o))
        .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''))
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
      const [intakeResp, draftPlans, pubPlans] = await Promise.all([
        request<{ cutoff_closed: boolean; published: boolean }>('/orders/intake-status').catch(
          () => ({ cutoff_closed: false, published: false }),
        ),
        request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[]),
        request<ApiPlan[]>('/plans?status=PUBLISHED').catch(() => [] as ApiPlan[]),
      ])

      const plan = draftPlans[0] ?? pubPlans[0]
      const trips = plan?.trips.map(mapTrip) ?? []
      const ordersUrl = plan?.delivery_date ? `/orders?date=${plan.delivery_date}` : '/orders'
      const orders = await request<ApiOrder[]>(ordersUrl)
        .then((os) => os.map((o) => mapOrder(o)))
        .catch(() => [] as Order[])

      let isReviewed = plan?.status === 'PUBLISHED'
      if (plan && !isReviewed) {
        try {
          isReviewed = localStorage.getItem(`waypoint.plan.reviewed.${plan.id}`) === 'true'
        } catch {}
      }

      return {
        orders,
        trips,
        status: {
          cutoffClosed: intakeResp.cutoff_closed,
          published: intakeResp.published,
          allocationReviewed: isReviewed,
        },
      }
    },

    async autoAllocate() {
      await request('/plans/auto-plan', { method: 'POST' })
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      if (plans[0]) {
        try {
          localStorage.removeItem(`waypoint.plan.reviewed.${plans[0].id}`)
        } catch {}
      }
    },

    async allocate(orderId, vehicleId, trip) {
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      const plan = plans[0]
      if (!plan) throw new Error('No draft plan to edit')
      const targetTrip = plan.trips.find(
        (t) => t.vehicle_id === vehicleId && t.trip_number === trip,
      )
      if (!targetTrip) throw new Error('Trip not found')
      try {
        localStorage.removeItem(`waypoint.plan.reviewed.${plan.id}`)
      } catch {}
      await request(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ moves: [{ order_id: Number(orderId), to_trip_id: targetTrip.id }] }),
      })
    },

    async unallocate(orderId) {
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      const plan = plans[0]
      if (plan) {
        try {
          localStorage.removeItem(`waypoint.plan.reviewed.${plan.id}`)
        } catch {}
        await request(`/plans/${plan.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ moves: [{ order_id: Number(orderId), to_trip_id: null }] }),
        })
      }
    },

    async defer(orderId, reason) {
      await request('/deferrals', {
        method: 'POST',
        body: JSON.stringify({
          order_id: Number(orderId),
          reason_code: toBackendReason(reason),
          explanation: reason,
        }),
      }).catch(() => {})
    },

    async reviewAllocation() {
      const plans = await request<ApiPlan[]>('/plans?status=DRAFT').catch(() => [] as ApiPlan[])
      const plan = plans[0]
      if (plan) {
        try {
          localStorage.setItem(`waypoint.plan.reviewed.${plan.id}`, 'true')
        } catch {}
        await request(`/plans/${plan.id}/validate`, { method: 'POST' }).catch(() => {})
      }
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

    async closeIntake() {
      await request('/orders/close', { method: 'POST' })
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
        brandRestricted: false,
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
            brandRestricted: false,
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
      // Only the driver has a current route; other roles are refused if they ask for it.
      const driver = getUser()?.role === 'DRIVER'
      const resp = driver ? await request<ApiTrip>('/driver/trips/current').catch(() => null) : null
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
      if (filter.outletId) {
        const stops = await request<ApiStop[]>(`/orders/stops?outlet_id=${filter.outletId}`).catch(() => null)
        if (stops) {
          return stops.map(mapStop)
        }
      }
      const resp = await request<ApiTrip>('/driver/trips/current').catch(() => null)
      if (resp?.stops) {
        return resp.stops
          .map(mapStop)
          .filter((s) => !filter.outletId || s.outlet === filter.outletId)
      }
      const stops = await request<ApiStop[]>('/orders/stops').catch(() => [] as ApiStop[])
      return stops.map(mapStop)
    },

    async startRoute() {
      await request('/driver/trips/start', { method: 'POST' }).catch(() => {})
    },

    async arrive(stopId) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      try {
        await request(`/driver/stops/${stopId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            client_op_id: opId,
            stop_id: Number(stopId),
            outcome: 'ARRIVED',
          }),
        })
      } catch {
        // Offline fallback: queue arrival event for later sync
        await localDb.queue.put({
          id: opId,
          evidenceId: opId,
          stopId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          revision: 1,
          kind: 'delivery',
        })
      }
    },

    async saveProof(stopId, proof) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      let photoUrl = ''

      // 1. Always store full evidence locally in IndexedDB first
      await localDb.evidence
        .put({
          id: opId,
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
          accepted: false,
        })
        .catch(() => {})

      await localDb.driverProofDrafts.delete(stopId).catch(() => {})

      // 2. Try online upload if connected
      let onlineSuccess = false
      try {
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
            client_op_id: opId,
            stop_id: Number(stopId),
            outcome: 'DELIVERED',
            note: `Delivered ${proof.quantity} cases`,
            pod_photo_path: photoUrl || null,
            receiver_name: proof.receiver || null,
            receiver_pin_ok: true,
          }),
        })

        // Online sync succeeded; mark evidence accepted
        const ev = await localDb.evidence.get(opId)
        if (ev) {
          ev.accepted = true
          await localDb.evidence.put(ev).catch(() => {})
        }
        onlineSuccess = true
      } catch {
        onlineSuccess = false
      }

      // 3. If offline or request failed, queue action for background sync
      if (!onlineSuccess) {
        await localDb.queue.put({
          id: opId,
          evidenceId: opId,
          stopId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          revision: proof.capturedRevision ?? 1,
          kind: 'delivery',
        })
      }
    },

    async reportIssue(stopId, issue) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      try {
        await request(`/driver/stops/${stopId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            client_op_id: opId,
            stop_id: Number(stopId),
            outcome: 'FAILED',
            note: issue,
          }),
        })
      } catch {
        await localDb.queue.put({
          id: opId,
          evidenceId: opId,
          stopId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          revision: 1,
          kind: 'attempt',
          message: issue,
        })
      }
    },

    async saveAttemptProof(stopId, photo, issue) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      let photoUrl = ''
      if (photo) {
        await localDb.evidence
          .put({
            id: opId,
            kind: 'attempt',
            entityId: stopId,
            photo,
            fileName: photo?.name ?? 'attempt-proof.jpg',
            createdAt: new Date().toISOString(),
            receiverException: issue,
            revision: 1,
            accepted: false,
          })
          .catch(() => {})
      }

      try {
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
            client_op_id: opId,
            stop_id: Number(stopId),
            outcome: 'FAILED',
            note: photoUrl ? `${issue} | Proof: ${photoUrl}` : issue,
          }),
        })

        const ev = await localDb.evidence.get(opId)
        if (ev) {
          ev.accepted = true
          await localDb.evidence.put(ev).catch(() => {})
        }
      } catch {
        await localDb.queue.put({
          id: opId,
          evidenceId: opId,
          stopId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          revision: 1,
          kind: 'attempt',
          message: issue,
        })
      }
    },

    async retryStop(stopId) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      try {
        await request(`/driver/stops/${stopId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            client_op_id: opId,
            stop_id: Number(stopId),
            outcome: 'ARRIVED',
            note: 'Retry stop',
          }),
        })
      } catch {
        await localDb.queue.put({
          id: opId,
          evidenceId: opId,
          stopId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          revision: 1,
          kind: 'delivery',
        })
      }
    },

    async confirmManagerHandoff(_outletId, stopId, proof) {
      await this.saveProof(stopId, proof)
    },

    async reportDelay(stopId, note, revisedEta, kind) {
      const opId = `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
      await request(`/driver/stops/${stopId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          client_op_id: opId,
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

    async sync(isOnline, options) {
      if (!isOnline) return
      const allQueued = await localDb.queue.toArray()
      const eligible = allQueued.filter((item) =>
        options?.retryFailed
          ? item.status === 'pending' || item.status === 'retry'
          : item.status === 'pending',
      )
      if (!eligible.length) return

      // Sort by creation time (epoch order)
      eligible.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      // Mark items as syncing
      for (const item of eligible) {
        item.status = 'syncing'
        item.attempts += 1
        await localDb.queue.put(item)
      }

      // Step 1: Upload any pending photos first
      const serverOrigin = (
        import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
      ).replace(/\/api\/v1\/?$/, '')

      const photoPaths: Record<string, string> = {}
      for (const item of eligible) {
        const ev = await localDb.evidence.get(item.evidenceId)
        if (ev?.photo && !photoPaths[item.id]) {
          try {
            const form = new FormData()
            form.append('file', ev.photo, ev.fileName || 'delivery-proof.jpg')
            form.append('stop_id', item.stopId)
            const uploadResp = await request<{ path: string }>('/driver/uploads', {
              method: 'POST',
              body: form,
            })
            if (uploadResp?.path) {
              photoPaths[item.id] = `${serverOrigin}${uploadResp.path}`
            }
          } catch {
            // Upload failure will be caught or retried
          }
        }
      }

      // Step 2: Build sync batch events
      const events = []
      for (const item of eligible) {
        const ev = await localDb.evidence.get(item.evidenceId)
        if (item.kind === 'delivery') {
          events.push({
            client_op_id: item.id,
            stop_id: Number(item.stopId),
            outcome: 'DELIVERED',
            note: ev?.quantity !== undefined ? `Delivered ${ev.quantity} cases` : 'Delivered',
            pod_photo_path: photoPaths[item.id] || null,
            receiver_name: ev?.receiver || null,
            receiver_pin_ok: true,
            recorded_at: item.createdAt,
          })
        } else {
          events.push({
            client_op_id: item.id,
            stop_id: Number(item.stopId),
            outcome: 'FAILED',
            note: photoPaths[item.id]
              ? `${item.message || 'Delivery attempt failed'} | Proof: ${photoPaths[item.id]}`
              : (item.message || 'Delivery attempt failed'),
            pod_photo_path: photoPaths[item.id] || null,
            recorded_at: item.createdAt,
          })
        }
      }

      // Step 3: Dispatch batch to /driver/sync
      try {
        const results = await request<
          Array<{ client_op_id: string; accepted: boolean; message?: string }>
        >('/driver/sync', {
          method: 'POST',
          body: JSON.stringify({ events }),
        })

        const resultMap = new Map(results.map((r) => [r.client_op_id, r]))

        for (const item of eligible) {
          const res = resultMap.get(item.id)
          if (res?.accepted) {
            item.status = 'accepted'
            await localDb.queue.put(item)
            const ev = await localDb.evidence.get(item.evidenceId)
            if (ev) {
              ev.accepted = true
              await localDb.evidence.put(ev).catch(() => {})
            }
          } else {
            item.status = 'retry'
            item.message = res?.message || 'Server rejected event'
            await localDb.queue.put(item)
          }
        }
      } catch (err: unknown) {
        // Network or server error: set to retry
        for (const item of eligible) {
          item.status = 'retry'
          item.message = err instanceof Error ? err.message : 'Sync request failed'
          await localDb.queue.put(item)
        }
        throw err
      }
    },

    async reviewQueuedRecord(id) {
      const item = await localDb.queue.get(id)
      if (item) {
        item.status = 'pending'
        await localDb.queue.put(item)
      }
    },
  }
}

// ── Fleet HTTP adapter ─────────────────────────────────────────────────────

function createHttpFleetApi(): FleetApi {
  return {
    async listVehicles() {
      const [vehicles, trips] = await Promise.all([
        request<Array<{
          vehicle_id: string
          type: string
          is_refrigerated: boolean
          weight_cap_kg: number
          volume_cap_m3: number
          brand?: string
          depot_code?: string
          status?: string
          lat?: number
          lng?: number
        }>>('/reference/vehicles').catch(() => []),
        request<ApiTrip[]>('/loading/trips').catch(() => [] as ApiTrip[]),
      ])

      const tripStatusByVehicle = new Map<string, string>()
      for (const t of trips) {
        if (t.status === 'IN_TRANSIT') tripStatusByVehicle.set(t.vehicle_id, 'En route')
        else if (t.status === 'LOADING') tripStatusByVehicle.set(t.vehicle_id, 'Loading')
      }

      return vehicles.map(
        (v): Vehicle => ({
          id: v.vehicle_id,
          brand: 'Fresh',
          brandRestricted: false,
          type: v.type === 'van' ? 'Van' : 'Truck',
          reefer: v.is_refrigerated,
          weightCapacity: v.weight_cap_kg,
          volumeCapacity: v.volume_cap_m3,
          status: (tripStatusByVehicle.get(v.vehicle_id) ?? 'Available') as Vehicle['status'],
          location: v.depot_code ?? 'Peliyagoda',
          lat: v.lat ?? (v.depot_code === 'Kandy' ? 7.29 : 6.965),
          lng: v.lng ?? (v.depot_code === 'Kandy' ? 80.63 : 79.885),
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
        depot_code?: string
        lat?: number
        lng?: number
      }>(`/reference/vehicles/${vehicleId}`).catch(() => null)
      if (!v) return undefined
      return {
        id: v.vehicle_id,
        brand: 'Fresh',
        brandRestricted: false,
        type: v.type === 'van' ? 'Van' : 'Truck',
        reefer: v.is_refrigerated,
        weightCapacity: v.weight_cap_kg,
        volumeCapacity: v.volume_cap_m3,
        status: 'Available',
        location: v.depot_code ?? 'Peliyagoda',
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
