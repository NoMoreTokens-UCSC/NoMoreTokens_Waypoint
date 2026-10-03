import { usePwaInstall } from '../../../hooks/usePwaInstall'
import { DriverButton } from '../atoms/DriverButton'
export function DriverPwaStatus() {
  const install = usePwaInstall()
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <p className="flex-1">
        {install.installed
          ? 'App installed.'
          : 'Install Waypoint from your browser menu for quick access.'}{' '}
        Open the app online once to cache screens. Photos and signatures are saved on this device;
        reconnect for sync.
      </p>
      {install.available && (
        <DriverButton variant="outline" onClick={() => void install.install()}>
          Install Waypoint
        </DriverButton>
      )}
    </div>
  )
}
