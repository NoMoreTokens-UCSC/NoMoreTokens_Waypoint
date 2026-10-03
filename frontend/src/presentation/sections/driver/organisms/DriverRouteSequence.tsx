import { Link } from 'react-router-dom'
import type { DriverDataState } from '../hooks/useDriverData'
import { Panel, StatusBadge } from '../../../shared/molecules/Common'

export function DriverRouteSequence({ state }: { state: DriverDataState }) {
  return (
    <Panel
      title="Outlet sequence & arrival estimates"
      description="Follow the published order. Estimates are saved planning times; driver updates are labelled."
    >
      <ol aria-label="Ordered delivery outlets" className="divide-y">
        {state.data?.stops.map((stop, index) => (
          <li key={stop.id} className="flex min-w-0 flex-wrap items-start gap-3 p-4">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
              aria-label={`Stop ${index + 1}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 basis-40 space-y-2">
              <Link
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                to={`/driver/navigation?stop=${encodeURIComponent(stop.id)}`}
              >
                {stop.outlet} · {stop.name}
              </Link>
              <p className="text-sm">
                Estimated arrival <strong>{stop.eta}</strong>
                {stop.etaUpdatedAt ? ' · Driver estimate' : ' · Planned'}
              </p>
              <p className="text-xs text-muted-foreground">
                Receiving window {stop.window}
                {stop.originalEta ? ` · Original ETA ${stop.originalEta}` : ''}
              </p>
            </div>
            <StatusBadge tone={stop.deliveryState === 'delivered' ? 'success' : 'neutral'}>
              {stop.deliveryState === 'delivered' ? 'Delivered' : stop.status}
            </StatusBadge>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
