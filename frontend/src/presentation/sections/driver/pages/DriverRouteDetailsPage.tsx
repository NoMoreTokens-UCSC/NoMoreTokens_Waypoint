import { DeliveryWindowNotice } from '../molecules/DeliveryWindowNotice'
import { useDriverData } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverLink } from '../molecules/DriverLink'
import { Panel, StatusBadge, EmptyState } from '../../../shared/molecules/Common'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'

export default function DriverRouteDetailsPage() {
  const state = useDriverData()
  useBreadcrumb([{ label: 'Current route', to: '/driver/route' }, { label: 'Manifest' }])
  return (
    <DriverScreen
      title="Route details & manifest"
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description="Follow the Dispatcher’s published sequence. Allocation and trip planning are managed by dispatch."
    >
      {state.data && (
        <Panel title={`${state.session.vehicleId} · Revision ${state.data.route.revision}`}>
          {state.data.stops.length ? (
            state.data.stops.map((stop, index) => (
              <article className="list-row flex-wrap! [&>div]:min-w-0" key={stop.id}>
                <div className="flex-1 flex min-w-0 flex-col gap-4">
                  <div className="eyebrow">
                    Stop {index + 1} · {stop.outlet}
                  </div>
                  <h2>{stop.name}</h2>
                  <p>{stop.address}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Window {stop.window} · ETA {stop.eta} · {stop.cases} cases
                  </p>
                  <ul className="text-sm leading-relaxed text-muted-foreground">
                    {state.data.orders
                      .filter((order) => stop.orderIds.includes(order.id))
                      .map((order) => (
                        <li key={order.id}>
                          {order.id} · {order.temperature} · {order.cases} cases · {order.weight} kg
                          · {order.volume.toFixed(1)} m³
                        </li>
                      ))}
                  </ul>
                  <DeliveryWindowNotice stop={stop} orders={state.data.orders} />
                  <DriverLink
                    to={`${stop.status === 'Upcoming' ? '/driver/navigation' : '/driver/delivery'}?stop=${encodeURIComponent(stop.id)}`}
                    variant="outline"
                  >
                    {stop.status === 'Upcoming'
                      ? `Navigate to ${stop.outlet}`
                      : `View ${stop.outlet} handoff`}
                  </DriverLink>
                </div>
                <StatusBadge tone={stop.deliveryState === 'delivered' ? 'success' : 'neutral'}>
                  {stop.deliveryState === 'delivered'
                    ? 'Delivered · demo acceptance'
                    : stop.status === 'Delivered'
                      ? 'Proof verification pending'
                      : stop.status}
                </StatusBadge>
              </article>
            ))
          ) : (
            <EmptyState
              title="No published deliveries"
              description="Dispatcher’s released manifest will appear here."
            />
          )}
        </Panel>
      )}
    </DriverScreen>
  )
}
