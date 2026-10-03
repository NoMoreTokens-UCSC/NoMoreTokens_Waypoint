import { DeliveryWindowNotice } from '../molecules/DeliveryWindowNotice'
import type { DriverStopState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { Panel, StatusBadge, EmptyState } from '../../../shared/molecules/Common'

export function DriverNextStop({ state }: { state: DriverStopState }) {
  const { stop } = state
  if (!stop)
    return (
      <Panel>
        <EmptyState
          title={
            state.data?.stops.length
              ? state.data.stops.every((item) => item.deliveryState === 'delivered')
                ? 'Trip complete'
                : 'No open deliveries'
              : 'No assigned stop'
          }
          description={
            state.data?.stops.length
              ? 'Review saved records and any unsuccessful attempts.'
              : 'Your published route will appear here.'
          }
          action={<DriverLink to="/driver/sync">Saved records</DriverLink>}
        />
      </Panel>
    )
  const target = !state.data?.route.started
    ? '/driver/pre-departure'
    : state.proof === 'accepted'
      ? state.href('/driver/delivered')
      : state.record
        ? state.href('/driver/sync')
        : state.draft || stop.status === 'Arrived'
          ? state.href('/driver/delivery')
          : state.href('/driver/navigation')
  const label = !state.data?.route.started
    ? 'Before-you-leave check'
    : state.proof === 'accepted'
      ? 'View accepted delivery'
      : state.record
        ? 'View saved proof'
        : state.draft
          ? 'Resume saved proof'
          : stop.status === 'Arrived'
            ? 'Record delivery photo'
            : 'Open turn-by-turn demo'
  return (
    <Panel title="Your next delivery">
      <div className="panel-body flex min-w-0 flex-col gap-4">
        <StatusBadge tone={state.proof === 'accepted' ? 'success' : 'neutral'}>
          {state.proof === 'accepted'
            ? 'Delivered · demo acceptance'
            : stop.status === 'Delivered'
              ? 'Awaiting proof verification'
              : stop.status}
        </StatusBadge>
        <h2>
          {stop.outlet} · {stop.name}
        </h2>
        <p>{stop.address}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ETA {stop.eta} · Window {stop.window} · {stop.cases} cases
        </p>
        <DeliveryWindowNotice stop={stop} orders={state.data?.orders ?? []} />
        <DriverLink to={target}>{label}</DriverLink>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Completion requires an accepted upload acknowledgement. A saved photo alone keeps the stop
          open.
        </p>
      </div>
    </Panel>
  )
}
