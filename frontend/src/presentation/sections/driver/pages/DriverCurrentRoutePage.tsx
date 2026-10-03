import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverRouteMap } from '../organisms/DriverRouteMap'
import { DriverNextStop } from '../organisms/DriverNextStop'
import { DriverLink } from '../molecules/DriverLink'
import { Notice, Panel } from '../../../shared/molecules/Common'

export default function DriverCurrentRoutePage() {
  const state = useDriverStop()
  return (
    <DriverScreen
      title="Current route"
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description={`${state.session.vehicleId ?? 'Assigned vehicle'} · Trip ${state.data?.load?.trip ?? 'unassigned'} · Revision ${state.data?.route.revision ?? '—'}`}
    >
      {!state.online && (
        <Notice title="Offline route">
          Your route, manifest and photographs remain saved on this device. Sync resumes when a
          connection returns.
        </Notice>
      )}
      {state.data && (
        <>
          <div className="max-[900px]:[&>section]:-order-1 grid grid-cols-1 items-start gap-4 min-[901px]:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <DriverNextStop state={state} />
              <Panel title="Daily shift progress">
                <div className="panel-body flex min-w-0 flex-col gap-4">
                  <h2>
                    {state.data.stops.filter((stop) => stop.deliveryState === 'delivered').length} /{' '}
                    {state.data.stops.length} stops
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Only accepted delivery proofs count as complete.
                  </p>
                </div>
              </Panel>
            </div>
            <DriverRouteMap
              stops={state.data.stops}
              stop={state.stop}
              vehicle={state.data.vehicle}
              offline={!state.online}
            />
          </div>
          <DriverActions>
            <DriverLink to="/driver/route/details" variant="secondary">
              Route details & manifest
            </DriverLink>
            <DriverLink to={state.href('/driver/issues')} variant="secondary">
              Report issue
            </DriverLink>
            <DriverLink to="/driver/sync" variant="outline">
              Saved records
            </DriverLink>
          </DriverActions>
        </>
      )}
    </DriverScreen>
  )
}
