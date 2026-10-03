/**
 * Waypoint HTTP API client.
 *
 * Reads VITE_API_URL from environment. All fetch calls go through this module
 * so the base URL and auth headers are set in one place.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export function getToken(): string | null {
  try {
    return localStorage.getItem('waypoint.token')
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem('waypoint.token', token)
  } catch {}
}

export function clearToken(): void {
  try {
    localStorage.removeItem('waypoint.token')
  } catch {}
}

export function getUser(): ApiUserProfile | null {
  try {
    const raw = localStorage.getItem('waypoint.user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setUser(user: ApiUserProfile): void {
  try {
    localStorage.setItem('waypoint.user', JSON.stringify(user))
  } catch {}
}

export function clearUser(): void {
  try {
    localStorage.removeItem('waypoint.user')
  } catch {}
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!resp.ok) {
    let errorBody: { error?: { code?: string; message?: string } } = {}
    try {
      errorBody = await resp.json()
    } catch {}
    throw new ApiError(
      resp.status,
      errorBody?.error?.code ?? 'API_ERROR',
      errorBody?.error?.message ?? `HTTP ${resp.status}`,
    )
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface ApiUserProfile {
  id: number
  username: string
  full_name: string
  role: string
  is_active: boolean
  outlet_id: string | null
  vehicle_id: string | null
  depot_id: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: ApiUserProfile
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const resp = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(resp.access_token)
  setUser(resp.user)
  return resp
}

export async function getMe(): Promise<ApiUserProfile> {
  const profile = await request<ApiUserProfile>('/auth/me')
  setUser(profile)
  return profile
}

export function logout(): void {
  clearToken()
  clearUser()
}

// ── Reference ─────────────────────────────────────────────────────────────

export interface ApiOutlet {
  outlet_id: string
  brand: string
  district: string
  depot_code: string
  dock_type: string
  parking_constraint: string | null
  van_only: boolean
  is_mall: boolean
  mall_window_open: string | null
  mall_window_close: string | null
  window_open_time: string | null
  window_close_time: string | null
  lat: number | null
  lng: number | null
}

export interface ApiVehicle {
  vehicle_id: string
  type: string
  temp: string
  is_refrigerated: boolean
  weight_cap_kg: number
  volume_cap_m3: number
  fuel_type: string
  km_per_l: number
  weekly_fuel_quota_l: number
  depot_code: string
}

export interface ApiDepot {
  code: string
  name: string
  lat: number | null
  lng: number | null
}

export interface ApiCalendarDay {
  date: string
  dow: number
  dow_name: string
  is_weekend: boolean
  iso_year: number
  iso_week: number
  is_payday: boolean
  festival: string | null
  festival_ramp: number
  is_holiday: boolean
  monsoon: boolean
  is_operating: boolean
}

export const referenceApi = {
  listOutlets: (params?: { depot?: string; brand?: string }): Promise<ApiOutlet[]> => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<ApiOutlet[]>(`/reference/outlets${qs ? `?${qs}` : ''}`)
  },
  listVehicles: (params?: { depot?: string }): Promise<ApiVehicle[]> => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<ApiVehicle[]>(`/reference/vehicles${qs ? `?${qs}` : ''}`)
  },
  listDepots: (): Promise<ApiDepot[]> => request<ApiDepot[]>('/reference/depots'),
  listCalendar: (from?: string, to?: string): Promise<ApiCalendarDay[]> => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<ApiCalendarDay[]>(`/reference/calendar?${params.toString()}`)
  },
}
