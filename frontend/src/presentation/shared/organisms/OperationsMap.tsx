import { useEffect } from 'react'
import { MapContainer, CircleMarker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useConnectivity } from '../../hooks/useOperations'
import type { Stop, Vehicle } from '../../../domain/models'
import { RouteMapViewport } from './RouteMapViewport'
import 'leaflet/dist/leaflet.css'

function FitMapToPoints({ vehicles, stops }: { vehicles: Vehicle[]; stops: Stop[] }) {
  const map = useMap()
  useEffect(() => {
    const points = [
      ...vehicles.map((vehicle) => [vehicle.lat, vehicle.lng] as [number, number]),
      ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
    ]
    if (points.length > 1) map.fitBounds(points, { padding: [64, 64], maxZoom: 11 })
  }, [map, vehicles, stops])
  return null
}

export default function OperationsMap({
  vehicles = [],
  stops = [],
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
  offline?: boolean
  onVehicleSelect?: (vehicle: Vehicle) => void
  delayedVehicleIds?: string[]
  fitRoute?: boolean
  recenterKey?: number
  selectedStopId?: string
  showCaption?: boolean
}) {
  const connected = useConnectivity()
  const points: [number, number][] = [
    [6.953, 79.884],
    ...stops.map((s) => [s.lat, s.lng] as [number, number]),
  ]
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
        <FitMapToPoints vehicles={vehicles} stops={stops} />
        {fitRoute && (
          <RouteMapViewport
            coordinates={JSON.stringify([...points, ...vehicles.map((v) => [v.lat, v.lng])])}
            recenterKey={recenterKey}
          />
        )}
        {connected && !offline && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {stops.length > 0 && (
          <Polyline positions={points} pathOptions={{ color: '#f26a2e', weight: 4 }} />
        )}
        {orderedVehicles.map((v) => (
          <CircleMarker
            key={v.id}
            center={v.id === 'VEH027' ? [v.lat + 0.002, v.lng + 0.002] : [v.lat, v.lng]}
            radius={7}
            eventHandlers={onVehicleSelect ? { click: () => onVehicleSelect(v) } : undefined}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: v.status === 'Offline' ? '#6e737b' : delayedVehicleIds.includes(v.id) ? '#c63a2f' : '#f26a2e',
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
        {stops.map((s) => (
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
