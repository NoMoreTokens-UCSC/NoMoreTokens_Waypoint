import type { Order, Stop } from '../../../../domain/models'
import { deliveryWindow } from '../../../../domain/deliveryWindow'
import { useDeviceClock } from '../../../hooks/useDeviceClock'
import { Notice } from '../../../shared/molecules/Common'
import { DriverLink } from './DriverLink'
export function DeliveryWindowNotice({ stop, orders }: { stop: Stop; orders: Order[] }) {
  const now = useDeviceClock(),
    window = deliveryWindow(stop, orders, now)
  if (
    stop.status === 'Cannot deliver' ||
    (stop.status === 'Delivered' && (!window.arrived || !window.overdue))
  )
    return null
  const warning = window.overdue || window.etaLate || window.dueSoon
  return (
    <Notice
      title={
        window.overdue
          ? window.arrived
            ? 'Arrival recorded after the delivery window'
            : 'Delivery window missed'
          : window.etaLate
            ? stop.etaUpdatedAt
              ? 'Driver estimate misses the delivery window'
              : 'Planned ETA misses the delivery window'
            : window.dueSoon
              ? 'Delivery window closing soon'
              : `Receive by ${window.deadline}`
      }
      tone={warning ? 'warning' : 'neutral'}
    >
      <p>
        {window.fresh ? 'Fresh food must reach the outlet by 08:00. ' : ''}Outlet deadline{' '}
        {window.deadline} · {stop.etaUpdatedAt ? 'Driver estimate' : 'planned ETA'} {stop.eta}.{' '}
        {window.arrived ? 'Deadline checked against recorded arrival.' : 'Clock uses Asia/Colombo.'}
      </p>
      {warning && ['Upcoming', 'Arrived'].includes(stop.status) && (
        <DriverLink
          to={`/driver/issues?stop=${encodeURIComponent(stop.id)}&kind=delay`}
          variant="outline"
        >
          Report a delay or delivery issue
        </DriverLink>
      )}
    </Notice>
  )
}
