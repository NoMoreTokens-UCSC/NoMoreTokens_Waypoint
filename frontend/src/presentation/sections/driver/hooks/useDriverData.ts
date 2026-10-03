import { useApiQuery } from '../../../hooks/useApiQuery'
import { driverDepartureErrors, nextDriverStop } from '../../../../domain/driverWorkflow'
import { useOperations } from '../../../hooks/useOperations'
import { useConnectivity } from '../../../hooks/useOperations'
import { useSession } from '../../../session/useSession'
import { useSearchParams } from 'react-router-dom'
import { deliveryStatus, proofStatus } from '../../../../domain/driverProof'
import { useDriverAutoSync } from './useDriverAutoSync'

export function useDriverData() {
  const session = useSession()
  const snapshot = useOperations()
  const online = useConnectivity()
  const query = useApiQuery(['driver', session.vehicleId], async (apis) => {
    const [route, loads, settings, queue, drafts, orders, vehicle, history] = await Promise.all([
      apis.delivery.getRoute(),
      apis.loading.listLoads(),
      apis.account.getSettings(),
      apis.delivery.listQueue(),
      apis.delivery.listProofDrafts(),
      apis.orders.listOrders(),
      session.vehicleId ? apis.fleet.getVehicle(session.vehicleId) : Promise.resolve(undefined),
      apis.delivery.listRouteHistory(),
    ])
    const evidenceIds = new Set([
      ...queue.map((record) => record.evidenceId),
      ...route.stops.flatMap((stop) => (stop.proofId ? [stop.proofId] : [])),
    ])
    const evidenceById = Object.fromEntries(
      await Promise.all(
        [...evidenceIds].map(async (id) => [id, await apis.delivery.getEvidence(id)] as const),
      ),
    )
    const load = loads.find((item) => item.vehicleId === session.vehicleId && item.trip === 1)
    const stops = route.stops.map((stop) => {
      const record = queue.find((item) => item.evidenceId === stop.proofId)
      const evidence = stop.proofId ? evidenceById[stop.proofId] : undefined
      return {
        ...stop,
        deliveryState: deliveryStatus(
          stop,
          proofStatus(evidence, record, undefined, { stop, orders }),
        ),
      }
    })
    return { route, stops, load, settings, queue, drafts, orders, vehicle, evidenceById, history }
  })
  const connected = online && !query.data?.settings.simulatedOffline
  const syncError = useDriverAutoSync(connected, query.data?.queue ?? [])
  return {
    ...query,
    session,
    online: connected,
    syncError,
    departureErrors: query.data?.route
      ? query.data.route.stops.length === 0
        ? ['No open deliveries are assigned to this truck.']
        : []
      : snapshot.data
        ? driverDepartureErrors(snapshot.data)
        : [],
  }
}

export function useDriverStop() {
  const state = useDriverData()
  const [params] = useSearchParams()
  const selected = params.get('stop')
  const stop = selected
    ? state.data?.stops.find((item) => item.id === selected)
    : nextDriverStop(state.data?.stops ?? [])
  const selectedRecord = params.get('record')
  const record = state.data?.queue.find((item) =>
    selectedRecord
      ? item.id === selectedRecord && item.stopId === stop?.id
      : item.evidenceId === stop?.proofId,
  )
  const draft = state.data?.drafts.find((item) => item.stopId === stop?.id)
  const evidenceId = selectedRecord ? record?.evidenceId : stop?.proofId
  const evidence = evidenceId ? state.data?.evidenceById[evidenceId] : undefined
  const proof = proofStatus(
    evidence,
    record,
    draft,
    !selectedRecord && stop ? { stop, orders: state.data?.orders ?? [] } : undefined,
  )
  return {
    ...state,
    stop,
    record,
    draft,
    evidence,
    proof,
    href: (path: string) => `${path}?stop=${encodeURIComponent(stop?.id ?? '')}`,
  }
}
export type DriverStopState = ReturnType<typeof useDriverStop>
export type DriverDataState = ReturnType<typeof useDriverData>
