import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useBlobUrl } from './useBlobUrl'
import { toast } from 'sonner'
import { useServices } from '../providers/ServicesContext'
import { useApis } from '../providers/ApisContext'

export const snapshotKey = ['operations', 'snapshot'] as const
export function useOperations() {
  const services = useServices()
  return useQuery({
    queryKey: snapshotKey,
    networkMode: 'always',
    queryFn: () => services.repository.getSnapshot(),
    staleTime: 5000,
  })
}
export function useAction() {
  const client = useQueryClient()
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => client.invalidateQueries({ queryKey: snapshotKey }),
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
