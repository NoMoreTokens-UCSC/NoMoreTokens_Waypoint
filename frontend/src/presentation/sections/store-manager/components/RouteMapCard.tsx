import { lazy, Suspense } from 'react'
import { Truck } from 'lucide-react'
import type { Order, Stop } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useConnectivity } from '../../../hooks/useOperations'
import { useSession } from '../../../session/useSession'
import { quantityText } from '../lib/orderView'
import type { RoutePhase } from './RouteMap'

// Leaflet is large, so the map is fetched only when this card is shown.
const RouteMap = lazy(() => import('./RouteMap'))

/** Depot locations (demo coordinates). A backend returns these with the route. */
const depots: Record<string, [number, number]> = {
  Peliyagoda: [6.953, 79.884],
  Kandy: [7.2906, 80.6337],
}

const phaseOf = (order: Order): RoutePhase =>
  order.status === 'Delivered'
    ? 'delivered'
    : order.status === 'En route'
      ? 'en-route'
      : order.status === 'Scheduled'
        ? 'scheduled'
        : 'pending'

const captions: Record<RoutePhase, (vehicle: string, outlet: string) => [string, string]> = {
  pending: (_, outlet) => [
    `${outlet} · Your outlet`,
    'The route and vehicle appear after dispatch',
  ],
  scheduled: (vehicle) => [`${vehicle} · Your assigned vehicle`, 'Planned route preview'],
  'en-route': (vehicle) => [
    `${vehicle} · Your assigned vehicle`,
    'Live position · This order only',
  ],
  delivered: (vehicle, outlet) => [`${vehicle} · Delivery location`, outlet],
}

/** The map for one order: only this outlet, this order's vehicle and the route between them. */
export function RouteMapCard({
  order,
  stop,
  outletId,
}: {
  order: Order
  stop?: Stop
  outletId: string
}) {
  const session = useSession()
  const connected = useConnectivity()
  const settings = useApiQuery(['settings'], (apis) => apis.account.getSettings())
  const phase = phaseOf(order)
  const [title, detail] = captions[phase](order.vehicleId ?? 'Vehicle', outletId)
  const depotName = session.depot && depots[session.depot] ? session.depot : 'Peliyagoda'
  return (
    <section className="sm-map-card" aria-label="Route">
      <div className="sm-map-head">
        <Truck size={20} color="#1E8A57" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
      </div>
      {stop ? (
        <Suspense fallback={<div className="sm-map sm-map-loading" aria-busy="true" />}>
          <RouteMap
            phase={phase}
            outletId={outletId}
            outlet={[stop.lat, stop.lng]}
            depot={depots[depotName]}
            depotName={depotName}
            vehicleId={order.vehicleId}
            online={connected && !settings.data?.simulatedOffline}
          />
        </Suspense>
      ) : (
        <p className="sm-map-offline">The location of {outletId} is not on file yet.</p>
      )}
      <p className="sm-map-legend">
        {outletId} · {quantityText(order)}
      </p>
    </section>
  )
}
