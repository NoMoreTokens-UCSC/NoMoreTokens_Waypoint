import { useEffect, useState } from 'react'
import {
  MapContainer,
  CircleMarker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { useConnectivity } from '../../hooks/useOperations'
import type { Order, Stop, Vehicle } from '../../../domain/models'
import { RouteMapViewport } from './RouteMapViewport'
import 'leaflet/dist/leaflet.css'

function FitMapToPoints({ coordinates }: { coordinates: string }) {
  const map = useMap()
  useEffect(() => {
    const points = JSON.parse(coordinates) as [number, number][]
    if (points.length > 1) map.fitBounds(points, { padding: [64, 64], maxZoom: 11 })
  }, [map, coordinates])
  return null
}

export default function OperationsMap({
  vehicles = [],
  stops = [],
  orders = [],
  selectedVehicleId,
  offline = false,
  onVehicleSelect,
  delayedVehicleIds = [],
  fitRoute = false,
  recenterKey = 0,
  selectedStopId,
  showCaption = true,
}: {
  vehicles?: Vehicle[]
  stops?: Stop[]
  orders?: Order[]
  selectedVehicleId?: string | null
  offline?: boolean
  onVehicleSelect?: (vehicle: Vehicle) => void
  delayedVehicleIds?: string[]
  fitRoute?: boolean
  recenterKey?: number
  selectedStopId?: string
  showCaption?: boolean
}) {
  const connected = useConnectivity()
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null)

  // Determine active vehicle from selection or hover
  const activeVehicleId = hoveredVehicleId || selectedVehicleId
  const activeVehicle = activeVehicleId ? vehicles.find((v) => v.id === activeVehicleId) : null

  // Get orders for the active vehicle
  const activeOrders = activeVehicleId
    ? orders.filter((o) => o.vehicleId === activeVehicleId)
    : []
  const activeOrderIds = new Set(activeOrders.map((o) => o.id))

  // Get stops for the active vehicle, filtered to only remaining/upcoming ones
  const remainingStops =
    activeVehicleId && activeVehicle
      ? stops
          .filter((s) => s.orderIds.some((id) => activeOrderIds.has(id)))
          .filter((s) => s.status === 'Upcoming' || s.status === 'Arrived')
          .sort((a, b) => {
            // Maintain order from the stops array (which should be sequenced)
            const aIndex = stops.indexOf(a)
            const bIndex = stops.indexOf(b)
            return aIndex - bIndex
          })
      : []

  // Build route: from vehicle position → through remaining stops
  const routePoints: [number, number][] =
    activeVehicle && remainingStops.length > 0
      ? [
          [activeVehicle.lat, activeVehicle.lng],
          ...remainingStops.map((s) => [s.lat, s.lng] as [number, number]),
        ]
      : []
  const orderedVehicles = [...vehicles].sort((a, b) => {
    const aPriority = a.id === 'VEH027' ? 2 : a.status === 'Offline' ? 1 : 0
    const bPriority = b.id === 'VEH027' ? 2 : b.status === 'Offline' ? 1 : 0
    return aPriority - bPriority
  })
  return (
    <div className="map-wrap">
      <MapContainer
        center={[6.974, 79.916]}
        zoom={12}
        scrollWheelZoom={false}
        className="operations-map"
        aria-label="Operations map"
      >
        {fitRoute ? (
          <RouteMapViewport
            coordinates={JSON.stringify(routePoints.length > 0 ? routePoints : [[6.974, 79.916]])}
            recenterKey={recenterKey}
          />
        ) : (
          <FitMapToPoints
            coordinates={JSON.stringify([
              ...vehicles.map((vehicle) => [vehicle.lat, vehicle.lng]),
              ...remainingStops.map((stop) => [stop.lat, stop.lng]),
            ])}
          />
        )}
        {connected && !offline && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {routePoints.length > 1 && (
          <Polyline positions={routePoints} pathOptions={{ color: '#f26a2e', weight: 4 }} />
        )}
        {orderedVehicles.map((v) => (
          <CircleMarker
            key={v.id}
            center={v.id === 'VEH027' ? [v.lat + 0.002, v.lng + 0.002] : [v.lat, v.lng]}
            radius={7}
            eventHandlers={{
              click: () => {
                if (onVehicleSelect) onVehicleSelect(v)
              },
              mouseover: () => {
                if (onVehicleSelect) setHoveredVehicleId(v.id)
              },
              mouseout: () => {
                setHoveredVehicleId(null)
              },
            }}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor:
                v.status === 'Offline'
                  ? '#6e737b'
                  : delayedVehicleIds.includes(v.id)
                    ? '#c63a2f'
                    : '#f26a2e',
              fillOpacity: 1,
            }}
          >
            <Tooltip
              permanent={v.id === 'VEH027' || v.status === 'Offline'}
              direction="top"
              offset={[0, -8]}
              className="vehicle-map-label"
            >
              {v.id}
            </Tooltip>
            {!onVehicleSelect && (
              <Popup>
                <strong>{v.id}</strong>
                <br />
                {v.location} · {v.status}
                <br />
                {v.reefer ? 'Refrigerated' : 'Ambient'} {v.type.toLowerCase()}
              </Popup>
            )}
          </CircleMarker>
        ))}
        {(activeVehicleId ? remainingStops : stops).map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.id === selectedStopId ? 13 : 10}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor:
                s.status === 'Delivered'
                  ? '#1e8a57'
                  : s.id === selectedStopId
                    ? '#f26a2e'
                    : '#22252a',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>
                {s.outlet} · {s.name}
              </strong>
              <br />
              {s.window}
              <br />
              {s.status}
            </Popup>
            {s.id === selectedStopId && (
              <Tooltip permanent direction="top">
                {s.outlet}
              </Tooltip>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
      {(!connected || offline) && (
        <div className="map-offline">
          Offline · saved route and stop locations. Basemap unavailable.
        </div>
      )}
      {showCaption && (
        <div className="map-caption">
          {vehicles.some((vehicle) => vehicle.positionSource === 'device')
            ? 'Last saved device GPS · remote sharing awaits backend'
            : 'Demo locations · not live vehicle telemetry'}
        </div>
      )}
    </div>
  )
}
