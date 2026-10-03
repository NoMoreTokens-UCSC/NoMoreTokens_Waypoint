import { lazy, Suspense, useState } from 'react'
import { DriverButton } from '../atoms/DriverButton'
import { StatusBadge } from '../../../shared/molecules/Common'
import type { Stop, Vehicle } from '../../../../domain/models'

const OperationsMap = lazy(() => import('../../../shared/organisms/OperationsMap'))

/** The same Leaflet adapter as Dispatcher, scoped to the Driver's assigned route. */
export function DriverRouteMap({
  stops,
  stop,
  vehicle,
  offline,
}: {
  stops: Stop[]
  stop?: Stop
  vehicle?: Vehicle
  offline: boolean
}) {
  const [recenterKey, setRecenterKey] = useState(0)
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      aria-label="Driver route map"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <StatusBadge tone={offline ? 'warning' : 'neutral'}>
          {offline ? 'Offline · saved locations' : 'Assigned route'}
        </StatusBadge>
        <DriverButton variant="outline" onClick={() => setRecenterKey((key) => key + 1)}>
          Recenter route
        </DriverButton>
      </div>
      <div className="[&_.operations-map]:h-[300px]! min-[901px]:[&_.operations-map]:h-[480px]! [&_.leaflet-control-zoom_a]:size-11! [&_.leaflet-control-zoom_a]:leading-11!">
        <Suspense
          fallback={
            <p
              className="grid h-[300px] place-items-center text-muted-foreground min-[901px]:h-[480px]"
              role="status"
            >
              Opening saved map…
            </p>
          }
        >
          <OperationsMap
            stops={stops}
            vehicles={vehicle ? [vehicle] : []}
            selectedStopId={stop?.id}
            offline={offline}
            fitRoute
            showCaption={false}
            recenterKey={recenterKey}
          />
        </Suspense>
      </div>
      <div className="flex flex-col gap-1 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {stop && (
          <p>
            Selected stop: {stop.outlet} · {stop.address}
          </p>
        )}
        <p>
          Saved stop sequence · connecting lines are not road directions.{' '}
          {vehicle?.positionSource === 'device'
            ? 'Vehicle marker uses the last locally saved device GPS fix.'
            : 'Vehicle location is simulated.'}
        </p>
      </div>
    </section>
  )
}
