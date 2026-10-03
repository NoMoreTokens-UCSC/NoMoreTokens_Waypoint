import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { liveQuery } from 'dexie'
import { ServicesContext } from '../../presentation/providers/ServicesContext'
import { OperationsService } from '../../application/OperationsService'
import { WaypointDatabase } from '../../infrastructure/persistence/database'
import { DexieOperationsRepository } from '../../infrastructure/persistence/DexieOperationsRepository'
import { DemoSyncGateway } from '../../infrastructure/demo/DemoSyncGateway'
import { snapshotKey } from '../../presentation/hooks/useOperations'
import { ApisContext } from '../../presentation/providers/ApisContext'
import { createApis } from '../apis'

const database = new WaypointDatabase()
const service = new OperationsService(
  new DexieOperationsRepository(database),
  new DemoSyncGateway(),
)
const apis = createApis(service)
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
    ]).subscribe({
      next: () => {
        void client.invalidateQueries({ queryKey: snapshotKey })
      },
      error: () => {},
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    // Retry once when the browser regains connectivity. Failed or revised
    // records remain available for an explicit recovery decision.
    const retryOnReconnect = () => {
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
