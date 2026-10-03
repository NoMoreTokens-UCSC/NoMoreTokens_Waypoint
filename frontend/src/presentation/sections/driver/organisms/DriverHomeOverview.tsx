import { nextDriverStop } from '../../../../domain/driverWorkflow'
import type { DriverDataState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { DriverActions } from '../molecules/DriverActions'
import { Metric, Panel, StatusBadge, EmptyState } from '../../../shared/molecules/Common'

export function DriverHomeOverview({ state }: { state: DriverDataState }) {
  const next = nextDriverStop(state.data?.stops ?? [])
  const delivered =
    state.data?.stops.filter((stop) => stop.deliveryState === 'delivered').length ?? 0
  const load = state.data?.load
  return (
    <>
      {state.data && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs leading-relaxed text-muted-foreground">
            <StatusBadge tone={state.online ? 'success' : 'warning'}>
              {state.online ? 'Online' : 'Offline · records saved locally'}
            </StatusBadge>
            <span>
              {state.session.vehicleId} · Trip {load?.trip ?? 'unassigned'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 min-[761px]:grid-cols-3 max-[760px]:[&>div:last-child]:col-span-full">
            <Metric
              label="Stops complete"
              value={`${delivered} / ${state.data.stops.length}`}
              detail="Accepted demo acknowledgements"
            />
            <Metric
              label="Cases on board"
              value={load?.items.reduce((sum, item) => sum + item.loaded, 0) ?? 0}
              detail="From the loading manifest"
            />
            <Metric
              label="Saved records"
              value={
                state.data.queue.filter(
                  (record) => !['accepted', 'superseded'].includes(record.status),
                ).length + state.data.drafts.length
              }
              detail="Local records awaiting completion"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <Panel title={next ? `Up next · ${next.outlet}` : 'Today’s route'}>
                <div className="panel-body flex min-w-0 flex-col gap-4">
                  {next ? (
                    <>
                      <h2>{next.name}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Window {next.window} · ETA {next.eta} · {next.cases} cases
                      </p>
                      <p>{next.address}</p>
                      <DriverActions>
                        <DriverLink
                          to={state.data.route.started ? '/driver/route' : '/driver/pre-departure'}
                        >
                          {state.data.route.started
                            ? 'Open current route'
                            : 'Before-you-leave check'}
                        </DriverLink>
                        <DriverLink to="/driver/route/details" variant="secondary">
                          View manifest
                        </DriverLink>
                      </DriverActions>
                    </>
                  ) : (
                    <EmptyState
                      title={
                        state.data.stops.length && delivered === state.data.stops.length
                          ? 'Trip complete'
                          : 'No open deliveries'
                      }
                      description="Manager quantities, remarks, and signature remain attached to the saved proof. Saved attempts and proof remain available."
                      action={<DriverLink to="/driver/sync">Saved records</DriverLink>}
                    />
                  )}
                </div>
              </Panel>
              <Panel title="Today’s assigned trip">
                <div className="panel-body flex min-w-0 flex-col gap-4">
                  <strong>
                    {state.session.vehicleId} · Trip {load?.trip ?? 'unassigned'}
                  </strong>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {state.data.stops.length} stops ·{' '}
                    {state.data.stops.reduce((sum, stop) => sum + stop.cases, 0)} cases · Revision{' '}
                    {state.data.route.revision}
                  </p>
                  <StatusBadge>
                    {load?.released ? 'Loaded and cleared' : 'Awaiting load clearance'}
                  </StatusBadge>
                </div>
              </Panel>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Panel title="Before you leave">
                <div className="panel-body flex min-w-0 flex-col gap-4">
                  <p>
                    {load?.items.reduce((sum, item) => sum + item.loaded, 0) ?? 0} of{' '}
                    {load?.items.reduce((sum, item) => sum + item.expected, 0) ?? 0} cases loaded
                  </p>
                  <p>{load?.photoId ? 'Loading photo attached' : 'Loading photo still required'}</p>
                  <p>{load?.completed ? 'Loader checks complete' : 'Loader checks pending'}</p>
                  <DriverLink to="/driver/pre-departure" variant="outline">
                    Check your load
                  </DriverLink>
                </div>
              </Panel>
              <Panel title="From dispatch">
                <div className="panel-body flex min-w-0 flex-col gap-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Follow the published stop sequence and delivery windows. Report a shortfall
                    before leaving so the Loader and Dispatcher can resolve it.
                  </p>
                  <DriverLink to="/driver/offline" variant="outline">
                    Offline route & records
                  </DriverLink>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}
