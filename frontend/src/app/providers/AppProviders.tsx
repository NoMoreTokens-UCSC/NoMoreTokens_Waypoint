import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { liveQuery } from 'dexie'
import { ServicesContext } from '../../presentation/providers/ServicesContext'
import { OperationsService } from '../../application/OperationsService'
import { WaypointDatabase } from '../../infrastructure/persistence/database'
import { DexieOperationsRepository } from '../../infrastructure/persistence/DexieOperationsRepository'
import { DemoSyncGateway } from '../../infrastructure/demo/DemoSyncGateway'
import { createEmptySeed } from '../../infrastructure/demo/seed'
import { snapshotKey } from '../../presentation/hooks/useOperations'
import { ApisContext } from '../../presentation/providers/ApisContext'
import { createSwitchableApis } from '../apis'
import { authChangedEvent } from '../../infrastructure/http/apiClient'

const database = new WaypointDatabase()
// With a real backend configured the browser starts empty; the demo's sample data is not loaded.
const realBackend = !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
const service = new OperationsService(
  new DexieOperationsRepository(
    database,
    realBackend ? { seed: createEmptySeed, purgeDemo: true } : undefined,
  ),
  new DemoSyncGateway(),
)
const apis = createSwitchableApis(service)
service.setApis(apis)
const client = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always', retry: 1, refetchOnWindowFocus: true },
    mutations: { networkMode: 'always', retry: false },
  },
})
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const subscription = liveQuery(async () => [
      await database.snapshots.get('workspace'),
      await database.queue.toArray(),
      await database.driverProofDrafts.toArray(),
    ]).subscribe({
      next: () => {
        void client.invalidateQueries({ queryKey: snapshotKey })
      },
      error: () => {},
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    // Whatever was fetched for the previous identity (or the demo) must not show for the next one.
    const dropCached = () => void client.resetQueries()
    window.addEventListener(authChangedEvent, dropCached)
    return () => window.removeEventListener(authChangedEvent, dropCached)
  }, [])
  useEffect(() => {
    // Retry once when the browser regains connectivity. Failed or revised
    // records remain available for an explicit recovery decision.
    const retryOnReconnect = () => {
      // Driver screens resume pending uploads through their API hook; failures need explicit retry.
      if (window.location.pathname.startsWith('/driver/')) return
      void service.repository
        .getSnapshot()
        .then((snapshot) => {
          if (
            !snapshot.settings.simulatedOffline &&
            snapshot.queue.some(
              (record) => record.status === 'pending' || record.status === 'retry',
            )
          )
            return service.sync(navigator.onLine)
        })
        .catch(() => {})
    }
    window.addEventListener('online', retryOnReconnect)
    return () => window.removeEventListener('online', retryOnReconnect)
  }, [])
  return (
    <QueryClientProvider client={client}>
      <ServicesContext.Provider value={service}>
        <ApisContext.Provider value={apis}>{children}</ApisContext.Provider>
      </ServicesContext.Provider>
    </QueryClientProvider>
  )
}
