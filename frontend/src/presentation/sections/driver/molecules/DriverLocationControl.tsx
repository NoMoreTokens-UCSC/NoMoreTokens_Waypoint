import { useDriverLocation } from '../hooks/DriverRuntime'
import { useOperations } from '../../../hooks/useOperations'
import { useSession } from '../../../session/useSession'
import { useDeviceClock } from '../../../hooks/useDeviceClock'
import { DriverButton } from '../atoms/DriverButton'

export function DriverLocationControl() {
  const location = useDriverLocation(),
    { data } = useOperations(),
    session = useSession(),
    now = useDeviceClock()
  const vehicle = data?.vehicles.find((item) => item.id === session.vehicleId)
  const age = vehicle?.positionUpdatedAt
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(vehicle.positionUpdatedAt)) / 1000))
    : undefined
  return (
    <section
      aria-label="Location updates"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {location.tracking
            ? 'GPS updates active while this workspace is open'
            : 'Location updates stopped'}
        </p>
        <p className="text-xs text-muted-foreground">
          {age === undefined
            ? 'The map currently shows a demo position.'
            : `Last device fix ${age}s ago${age > 60 ? ' · stale' : ''} · accuracy ±${Math.round(vehicle?.positionAccuracy ?? 0)}m. Saved locally; remote sharing awaits the backend.`}
        </p>
        {location.error && (
          <p role="alert" className="text-destructive">
            {location.error}
          </p>
        )}
      </div>
      <DriverButton
        variant="outline"
        disabled={!data?.settings.routeStarted}
        onClick={location.tracking ? location.stop : location.start}
      >
        {location.tracking ? 'Stop location updates' : 'Start location updates'}
      </DriverButton>
    </section>
  )
}
