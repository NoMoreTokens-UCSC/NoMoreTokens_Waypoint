import { Marker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { depotIcon, outletIcon, vehicleIcon } from './mapIcons'

export type RoutePhase = 'pending' | 'scheduled' | 'en-route' | 'delivered'

/**
 * The outlet-only route map: the depot, the assigned vehicle and this outlet, with the route drawn
 * between them. The outlet comes from its stop record. There is no vehicle telemetry yet, so while
 * en route the vehicle is drawn on the route (about 40% of the way) as an illustration; pass real
 * positions here once the backend provides them. Without a connection the basemap is left out and
 * the route and markers still show.
 */
const EN_ROUTE_PROGRESS = 0.4
const along = (from: LatLngTuple, to: LatLngTuple, fraction: number): LatLngTuple => [
  from[0] + (to[0] - from[0]) * fraction,
  from[1] + (to[1] - from[1]) * fraction,
]

export default function RouteMap({
  phase,
  outletId,
  outlet,
  depot,
  depotName,
  vehicleId,
  online,
}: {
  phase: RoutePhase
  outletId: string
  outlet: LatLngTuple
  depot: LatLngTuple
  depotName: string
  vehicleId?: string
  online: boolean
}) {
  const planned = phase !== 'pending'
  // The vehicle waits at the depot until it leaves and is at the outlet once delivered.
  const vehiclePosition: LatLngTuple | undefined = !planned
    ? undefined
    : phase === 'delivered'
      ? outlet
      : phase === 'en-route'
        ? along(depot, outlet, EN_ROUTE_PROGRESS)
        : depot
  // Everything that is drawn must be inside the view, the vehicle included.
  const bounds: LatLngBoundsExpression = planned
    ? [depot, outlet, ...(vehiclePosition ? [vehiclePosition] : [])]
    : [outlet, outlet]
  return (
    <div className="sm-map">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [56, 56], maxZoom: 14 }}
        scrollWheelZoom={false}
        className="sm-leaflet"
        aria-label={`Map of the route to ${outletId}`}
      >
        {online && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {planned && (
          <Polyline positions={[depot, outlet]} pathOptions={{ color: '#f26a2e', weight: 5 }} />
        )}
        {planned && (
          <Marker position={depot} icon={depotIcon}>
            <Tooltip direction="bottom" offset={[0, 6]} permanent>
              {depotName}
            </Tooltip>
          </Marker>
        )}
        <Marker position={outlet} icon={outletIcon}>
          <Tooltip direction="top" offset={[0, -10]} permanent>
            {outletId}
          </Tooltip>
        </Marker>
        {vehiclePosition && (
          <Marker position={vehiclePosition} icon={vehicleIcon} zIndexOffset={500}>
            <Tooltip direction="top" offset={[0, -18]}>
              {vehicleId}
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
      {!online && (
        <p className="sm-map-offline">
          Offline · the route and locations are saved; the basemap needs a connection.
        </p>
      )}
    </div>
  )
}
