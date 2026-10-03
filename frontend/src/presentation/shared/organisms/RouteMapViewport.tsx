import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { LatLngTuple } from 'leaflet'

/** Coordinate changes and explicit recenter requests fit the route; query refreshes preserve zoom. */
export function RouteMapViewport({
  coordinates,
  recenterKey,
}: {
  coordinates: string
  recenterKey: number
}) {
  const map = useMap()
  useEffect(() => {
    const points = JSON.parse(coordinates) as LatLngTuple[]
    if (points.length) map.fitBounds(points, { padding: [32, 32], maxZoom: 14, animate: false })
  }, [map, coordinates, recenterKey])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}
