import { DeliveryWindowNotice } from '../molecules/DeliveryWindowNotice'
import type { DriverStopState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { DriverButton as Button } from '../atoms/DriverButton'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from '../hooks/useDriverAction'
import { Panel, StatusBadge, EmptyState } from '../../../shared/molecules/Common'

export function DriverNextStop({ state }: { state: DriverStopState }) {
  const { stop } = state
  const apis = useApis()
  const action = useDriverAction()

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

  return (
    <Panel title="Your next delivery">
      <div className="panel-body flex min-w-0 flex-col gap-4">
        <StatusBadge tone={state.proof === 'accepted' ? 'success' : 'neutral'}>
          {state.proof === 'accepted'
            ? 'Delivered · verified'
            : stop.status === 'Delivered'
              ? 'Awaiting proof verification'
              : stop.status}
        </StatusBadge>
        <h2>
          {stop.outlet} · {stop.name}
        </h2>
        <p>{stop.address}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Estimated arrival {stop.eta}
          {stop.etaUpdatedAt ? ' · Driver estimate' : ' · Planned'} · Window {stop.window} ·{' '}
          {stop.cases} cases
        </p>
        <DeliveryWindowNotice stop={stop} orders={state.data?.orders ?? []} />

        {!state.data?.route.started ? (
          <div className="flex flex-col gap-2">
            <Button
              disabled={action.isPending}
              onClick={() => {
                action.runAndNavigate(() => apis.delivery.startRoute(), '/driver/route', 'Route started')
              }}
            >
              {action.isPending ? 'Starting route…' : 'Start Route (Depart Depot)'}
            </Button>
            <DriverLink to="/driver/pre-departure" variant="secondary">
              Pre-departure vehicle checklist
            </DriverLink>
          </div>
        ) : stop.status === 'Upcoming' ? (
          <div className="flex flex-col gap-2">
            <Button
              disabled={action.isPending}
              onClick={() => {
                action.runAndNavigate(
                  () => apis.delivery.arrive(stop.id),
                  state.href('/driver/delivery'),
                  'Arrival recorded at stop',
                )
              }}
            >
              {action.isPending ? 'Recording arrival…' : 'Mark Arrival at Stop'}
            </Button>
            <DriverLink to={state.href('/driver/delivery')} variant="secondary">
              Open delivery & proof
            </DriverLink>
          </div>
        ) : state.proof === 'accepted' ? (
          <DriverLink to={state.href('/driver/delivered')}>
            View accepted delivery
          </DriverLink>
        ) : (
          <div className="flex flex-col gap-2">
            <DriverLink to={state.href('/driver/delivery')}>
              {state.draft ? 'Resume delivery proof' : 'Record delivery photo & sign-off'}
            </DriverLink>
          </div>
        )}

        <p className="text-sm leading-relaxed text-muted-foreground">
          Recording proof transitions customer orders to Delivered in real time.
        </p>
      </div>
    </Panel>
  )
}
