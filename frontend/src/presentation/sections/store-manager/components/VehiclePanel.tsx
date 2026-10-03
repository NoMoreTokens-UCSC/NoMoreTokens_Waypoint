import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { Order, Stop, Vehicle } from '../../../../domain/models'
import { clock12 } from '../lib/timeText'
import { formatTime12 } from '../lib/windows'

/** "Refrigerated truck", "Dry-box truck", "Van". */
export function vehicleKind(vehicle: Pick<Vehicle, 'type' | 'reefer'>) {
  if (vehicle.type === 'Van') return vehicle.reefer ? 'Refrigerated van' : 'Van'
  return vehicle.reefer ? 'Refrigerated truck' : 'Dry-box truck'
}

/**
 * What the store may know about the vehicle bringing an order: its kind, who drives it, which trip
 * the order is on and when it is expected, so receiving staff can be ready. Opened by selecting the
 * vehicle on the map. Phone numbers and live telematics stay with dispatch.
 */
export function VehiclePanel({
  order,
  stop,
  vehicle,
  driver,
  depot,
  onClose,
}: {
  order: Order
  stop?: Stop
  vehicle?: Vehicle | null
  driver?: string
  depot: string
  onClose: () => void
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  const delivered = order.status === 'Delivered'
  const rows: [string, string][] = [
    ['Type', vehicle ? vehicleKind(vehicle) : '—'],
    ['Driver', driver ?? 'Not assigned yet'],
    ['Trip', order.trip ? `Trip ${order.trip}` : '—'],
    ['Depot', depot],
    delivered
      ? ['Delivered at', order.deliveredAt ? clock12(order.deliveredAt) : '—']
      : [
          order.status === 'En route' ? 'Expected arrival' : 'Planned arrival',
          stop?.eta ? formatTime12(stop.eta) : '—',
        ],
  ]
  return (
    <aside className="sm-vehicle-panel" aria-label={`Vehicle ${order.vehicleId ?? ''} details`}>
      <header>
        <strong>{order.vehicleId}</strong>
        <button type="button" aria-label="Close vehicle details" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
