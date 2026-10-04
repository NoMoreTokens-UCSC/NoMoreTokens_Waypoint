import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useBlobUrl } from './useBlobUrl'
import { toast } from 'sonner'
import { useServices } from '../providers/ServicesContext'
import { useApis } from '../providers/ApisContext'

import { getToken, getUser } from '../../infrastructure/http/apiClient'
import type { Snapshot, Stop } from '../../domain/models'
import type { Apis } from '../../domain/api'
import type { OperationsService } from '../../application/OperationsService'

/**
 * With a backend, the demo's orders, vehicles, stops, loads and team never show: what the server did not
 * supply is empty. Device-only data (offline queue, saved proof, preferences) is kept.
 */
function withoutDemoData(
  base: Snapshot,
  prefs?: Pick<Snapshot['settings'], 'notifications' | 'compactRows'>,
): Snapshot {
  const user = getUser()
  return {
    ...base,
    orders: [],
    vehicles: [],
    stops: [],
    loads: [],
    members: [],
    activeOutletId: user?.outlet_id ?? undefined,
    activeDriverId: user ? String(user.id) : undefined,
    settings: {
      ...base.settings,
      simulatedOffline: false,
      profileName: user?.full_name ?? '',
      profilePhone: '',
      // Preferences chosen on this device (Preferences page) win over what the browser store holds.
      ...(prefs ? { notifications: prefs.notifications, compactRows: prefs.compactRows } : {}),
    },
  }
}

async function getLiveSnapshot(apis: Apis, services: OperationsService): Promise<Snapshot> {
  const base = await services.repository.getSnapshot()
  const prefs = await apis.account.getSettings().catch(() => undefined)
  const clean = withoutDemoData(base, prefs)
  // Planning, loading and route data belong to other roles: a store manager's request for them is refused.
  if (getUser()?.role === 'STORE_MANAGER') return clean
  try {
    const user = getUser()
    const roleUpper = (user?.role || '').toUpperCase()
    const canAccessPlanning = !user || roleUpper === 'DISPATCHER' || roleUpper === 'ADMIN'

    const [planState, vehicles, loads] = await Promise.all([
      canAccessPlanning ? apis.planning.getPlan().catch(() => null) : Promise.resolve(null),
      apis.fleet.listVehicles().catch(() => []),
      apis.loading.listLoads().catch(() => []),
    ])

    // Roles without planning access still learn from the server whether intake is closed and the plan published.
    const intake = planState ? null : await apis.orders.getIntakeStatus().catch(() => null)

    const stops: Stop[] = []
    if (loads && loads.length > 0) {
      for (const load of loads) {
        for (const item of load.items) {
          stops.push({
            id: `${load.id}-${item.stop}`,
            loadId: load.id,
            outlet: item.outlet,
            name: item.name,
            address: item.district ?? '',
            window: item.window ?? '',
            eta: item.eta ?? load.departureTime ?? '',
            lat: item.lat ?? 0,
            lng: item.lng ?? 0,
            orderIds: planState
              ? planState.orders.filter((o) => o.outlet === item.outlet).map((o) => o.id)
              : [],
            cases: item.expected,
            status: load.completed ? 'Delivered' : 'Upcoming',
          })
        }
      }
    }

    return {
      ...clean,
      orders: planState ? planState.orders : [],
      vehicles,
      stops,
      loads,
      settings: planState
        ? {
            ...clean.settings,
            cutoffClosed: planState.status.cutoffClosed,
            published: planState.status.published,
            allocationReviewed: planState.status.allocationReviewed,
          }
        : intake
          ? { ...clean.settings, cutoffClosed: intake.cutoffClosed, published: intake.published }
          : clean.settings,
    }
  } catch {
    return clean
  }
}

export const snapshotKey = ['operations', 'snapshot'] as const
export function useOperations() {
  const services = useServices()
  const apis = useApis()
  return useQuery({
    queryKey: snapshotKey,
    networkMode: 'always',
    queryFn: () => (getToken() ? getLiveSnapshot(apis, services) : services.repository.getSnapshot()),
    staleTime: 5000,
  })
}
export function useAction() {
  const client = useQueryClient()
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (action: () => Promise<unknown>) => action(),
    // Wait for the refresh: callers navigate right after a write, and the next screen's guards must see
    // the saved data, not the old copy.
    onSuccess: async () => {
      void client.invalidateQueries({ queryKey: ['orders'] })
      void client.invalidateQueries({ queryKey: ['planning'] })
      void client.invalidateQueries({ queryKey: ['loads'] })
      void client.invalidateQueries({ queryKey: ['fleet'] })
      await client.invalidateQueries({ queryKey: snapshotKey })
    },
    onError: (error: Error) => {
      toast.error(error.message)
      void client.invalidateQueries({ queryKey: snapshotKey })
    },
  })
  return {
    ...mutation,
    run: (action: () => Promise<unknown>, message?: string) =>
      mutation.mutate(action, {
        onSuccess: () => {
          if (message) toast.success(message)
        },
      }),
  }
}
export function useConnectivity() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed)
    window.addEventListener('offline', changed)
    return () => {
      window.removeEventListener('online', changed)
      window.removeEventListener('offline', changed)
    }
  }, [])
  return online
}
export function useEvidence(id?: string) {
  const apis = useApis()
  const isDirectUrl = Boolean(
    id &&
      (id.startsWith('blob:') ||
        id.startsWith('http://') ||
        id.startsWith('https://') ||
        id.startsWith('/uploads')),
  )
  const query = useQuery({
    queryKey: [...snapshotKey, 'api', 'evidence', id],
    networkMode: 'always',
    queryFn: async () => (id ? ((await apis.delivery.getEvidence(id)) ?? null) : null),
    enabled: Boolean(id && !isDirectUrl),
  })
  const blobUrl = useBlobUrl(query.data?.photo)
  const url = isDirectUrl
    ? id?.startsWith('/uploads')
      ? `${(import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '')}${id}`
      : id
    : blobUrl
  return {
    evidence: query.data ?? undefined,
    url,
    isPending: isDirectUrl ? false : query.isPending,
    isError: isDirectUrl ? false : query.isError,
    error: isDirectUrl ? null : query.error,
    refetch: query.refetch,
  }
}
