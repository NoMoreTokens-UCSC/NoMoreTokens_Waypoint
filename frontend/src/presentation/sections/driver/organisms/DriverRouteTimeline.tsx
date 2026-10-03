import type { RouteEvent, RouteEventKind } from '../../../../domain/routeHistory'
import { EmptyState, Panel } from '../../../shared/molecules/Common'

const labels: Record<RouteEventKind, string> = {
  loaderConfirmed: 'Loader confirmed truck',
  released: 'Dispatcher released truck',
  started: 'Route started',
  arrived: 'Arrived at outlet',
  proofSaved: 'Proof saved locally',
  accepted: 'Delivery accepted',
  delay: 'Delay reported',
  breakdown: 'Vehicle breakdown',
  attempt: 'Unsuccessful attempt',
  reopened: 'Stop reopened',
  completed: 'Route completed',
}
export function DriverRouteTimeline({ events }: { events: RouteEvent[] }) {
  return (
    <Panel title="Route activity">
      {events.length ? (
        <ol className="divide-y" aria-label="Route activity timeline">
          {[...events]
            .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
            .map((event) => (
              <li
                key={event.id}
                className="flex min-w-0 flex-col gap-2 p-4 min-[480px]:flex-row min-[480px]:gap-4"
              >
                <time dateTime={event.at} className="shrink-0 text-sm font-semibold tabular-nums">
                  {new Date(event.at).toLocaleTimeString('en-GB', {
                    timeZone: 'Asia/Colombo',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm font-semibold">
                    {labels[event.kind]}
                    {event.outletId ? ` · ${event.outletId}` : ''}
                  </h2>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {event.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.vehicleId} · Trip {event.trip} · Revision {event.revision}
                  </p>
                </div>
              </li>
            ))}
        </ol>
      ) : (
        <EmptyState
          title="No route activity recorded yet"
          description="New loading confirmations, departures, arrivals and outcomes will appear here. Earlier activity is not reconstructed."
        />
      )}
    </Panel>
  )
}
