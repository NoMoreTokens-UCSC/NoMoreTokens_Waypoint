import { useEffect, useRef, useState } from 'react'
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
import type { Stop, Vehicle } from '../../../domain/models'
import { RouteMapViewport } from './RouteMapViewport'
import 'leaflet/dist/leaflet.css'

/** Fits the map to the fleet once, on first load. Later data refreshes do not move the view. */
function FitMapToPoints({ coordinates }: { coordinates: string }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    const points = JSON.parse(coordinates) as [number, number][]
    if (points.length > 1) {
      map.fitBounds(points, { padding: [64, 64], maxZoom: 11 })
      fitted.current = true
    }
  }, [map, coordinates])
  return null
}

export default function OperationsMap({
  vehicles = [],
  stops = [],
  selectedVehicleId,
  offline = false,
  onVehicleSelect,
  delayedVehicleIds = [],
  fitRoute = false,
  recenterKey = 0,
  selectedStopId,
  showCaption = true,
  vehicleOrders = {},
}: {
  vehicles?: Vehicle[]
  stops?: Stop[]
  selectedVehicleId?: string | null
  offline?: boolean
  onVehicleSelect?: (vehicle: Vehicle) => void
  delayedVehicleIds?: string[]
  fitRoute?: boolean
  recenterKey?: number
  selectedStopId?: string
  showCaption?: boolean
  vehicleOrders?: Record<string, string[]>
}) {
  const connected = useConnectivity()
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null)

  // Determine active vehicle from selection or hover
  const activeVehicleId = hoveredVehicleId || selectedVehicleId


  // Vehicles with no coordinates at all are left off the map.
  const plotted = vehicles.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))

  // One route per vehicle: from its current position through the stops on its orders
  const routes = plotted.flatMap((v) => {
    if (v.status === 'Offline') return []
    const ids = new Set(vehicleOrders[v.id] ?? [])
    const vehicleStops = stops
      .filter((s) => s.orderIds.some((id) => ids.has(id)) && s.status !== 'Delivered')
      .sort((a, b) => a.eta.localeCompare(b.eta))
    if (!vehicleStops.length) return []
    return [
      {
        vehicleId: v.id,
        points: [
          [v.lat, v.lng],
          ...vehicleStops.map((s) => [s.lat, s.lng] as [number, number]),
        ] as [number, number][],
      },
    ]
  })

  // Stops of the active vehicle, used for the dots while a vehicle is selected or hovered
  const activeOrderIds = new Set(activeVehicleId ? (vehicleOrders[activeVehicleId] ?? []) : [])
  const remainingStops = activeVehicleId
    ? stops.filter((s) => s.orderIds.some((id) => activeOrderIds.has(id)))
    : []
  const orderedVehicles = [...plotted].sort((a, b) => {
    const aPriority = delayedVehicleIds.includes(a.id) ? 2 : a.status === 'Offline' ? 1 : 0
    const bPriority = delayedVehicleIds.includes(b.id) ? 2 : b.status === 'Offline' ? 1 : 0
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
            coordinates={JSON.stringify(
              routes.length > 0 ? routes.flatMap((r) => r.points) : [[6.974, 79.916]],
            )}
            recenterKey={recenterKey}
          />
        ) : !selectedVehicleId ? (
          <FitMapToPoints
            coordinates={JSON.stringify([
              ...plotted.map((vehicle) => [vehicle.lat, vehicle.lng]),
              ...stops.map((stop) => [stop.lat, stop.lng]),
            ])}
          />
        ) : null}
        {connected && !offline && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {routes
          .filter((route) => route.vehicleId === activeVehicleId)
          .map((route) => (
            <Polyline
              key={route.vehicleId}
              positions={route.points}
              pathOptions={{
                color: delayedVehicleIds.includes(route.vehicleId) ? '#c63a2f' : '#f26a2e',
                weight: 2,
              }}
            />
          ))}
        {orderedVehicles.map((v) => (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
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
              permanent={delayedVehicleIds.includes(v.id) || v.status === 'Offline'}
              direction="top"
              offset={[0, -8]}
              className="vehicle-map-label"
            >
              {v.positionSource === 'device' ? v.id : `${v.id} · no GPS`}
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
            radius={s.id === selectedStopId ? 6 : 4}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor:
                s.status === 'Delivered'
                  ? '#1e8a57'
                  : s.id === selectedStopId
                    ? '#f26a2e'
                    : '#22252a',
              fillOpacity: 1,
            }}
            eventHandlers={{
              mouseover: () => {
                if (activeVehicleId && onVehicleSelect) setHoveredVehicleId(activeVehicleId)
              },
              mouseout: () => {
                if (!selectedVehicleId) setHoveredVehicleId(null)
              },
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
            ? 'Latest device GPS · offline after 15 minutes without a report'
            : 'Demo locations · not live vehicle telemetry'}
        </div>
      )}
    </div>
  )
}
