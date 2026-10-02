import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
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
  const query = useQuery({
    queryKey: [...snapshotKey, 'api', 'evidence', id],
    networkMode: 'always',
    queryFn: () => apis.delivery.getEvidence(id!),
    enabled: Boolean(id),
  })
  const url = useMemo(
    () => (query.data ? URL.createObjectURL(query.data.photo) : undefined),
    [query.data],
  )
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  return {
    evidence: query.data,
    url,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
