import { MapContainer, CircleMarker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { useConnectivity } from '../../hooks/useOperations'
import type { Stop, Vehicle } from '../../../domain/models'
import 'leaflet/dist/leaflet.css'

export default function OperationsMap({
  vehicles = [],
  stops = [],
  offline = false,
}: {
  vehicles?: Vehicle[]
  stops?: Stop[]
  offline?: boolean
}) {
  const connected = useConnectivity()
  const points: [number, number][] = [
    [6.953, 79.884],
    ...stops.map((s) => [s.lat, s.lng] as [number, number]),
  ]
  return (
    <div className="map-wrap">
      <MapContainer
        center={[6.974, 79.916]}
        zoom={12}
        scrollWheelZoom={false}
        className="operations-map"
        aria-label="Operations map"
      >
        {connected && !offline && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {stops.length > 0 && (
          <Polyline positions={points} pathOptions={{ color: '#f26a2e', weight: 4 }} />
        )}
        {vehicles.map((v) => (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={7}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: v.status === 'Offline' ? '#6e737b' : '#f26a2e',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>{v.id}</strong>
              <br />
              {v.location} · {v.status}
              <br />
              {v.reefer ? 'Refrigerated' : 'Ambient'} {v.type.toLowerCase()}
            </Popup>
          </CircleMarker>
        ))}
        {stops.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={10}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor: s.status === 'Delivered' ? '#1e8a57' : '#22252a',
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
          </CircleMarker>
        ))}
      </MapContainer>
      {(!connected || offline) && (
        <div className="map-offline">
          Offline · saved route and stop locations. Basemap unavailable.
        </div>
      )}
      <div className="map-caption">Demo locations · not live vehicle telemetry</div>
    </div>
  )
}
