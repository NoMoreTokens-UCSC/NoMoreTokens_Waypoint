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

async function getLiveSnapshot(apis: Apis, services: OperationsService): Promise<Snapshot> {
  const base = await services.repository.getSnapshot()
  try {
    const user = getUser()
    const roleUpper = (user?.role || '').toUpperCase()
    const canAccessPlanning = !user || roleUpper === 'DISPATCHER' || roleUpper === 'ADMIN'

    const [planState, vehicles, loads] = await Promise.all([
      canAccessPlanning ? apis.planning.getPlan().catch(() => null) : Promise.resolve(null),
      apis.fleet.listVehicles().catch(() => []),
      apis.loading.listLoads().catch(() => []),
    ])

    const stops: Stop[] = []
    if (loads && loads.length > 0) {
      for (const load of loads) {
        for (const item of load.items) {
          stops.push({
            id: `${load.id}-${item.stop}`,
            loadId: load.id,
            outlet: item.outlet,
            name: item.name,
            address: 'Colombo',
            window: '05:00',
            eta: load.departureTime ?? '05:00',
            lat: 6.93,
            lng: 79.86,
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
      ...base,
      orders: planState ? planState.orders : base.orders,
      vehicles: vehicles.length > 0 ? vehicles : base.vehicles,
      stops: stops.length > 0 ? stops : base.stops,
      loads: loads.length > 0 ? loads : base.loads,
      settings: planState
        ? {
            ...base.settings,
            cutoffClosed: planState.status.cutoffClosed,
            published: planState.status.published,
            allocationReviewed: planState.status.allocationReviewed,
          }
        : base.settings,
    }
  } catch {
    return base
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
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: snapshotKey })
      void client.invalidateQueries({ queryKey: ['orders'] })
      void client.invalidateQueries({ queryKey: ['planning'] })
      void client.invalidateQueries({ queryKey: ['loads'] })
      void client.invalidateQueries({ queryKey: ['fleet'] })
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
