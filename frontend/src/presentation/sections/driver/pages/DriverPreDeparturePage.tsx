import { DriverActions } from '../molecules/DriverActions'
import { useState } from 'react'
import { useDriverData } from '../hooks/useDriverData'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from '../hooks/useDriverAction'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverLink } from '../molecules/DriverLink'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Panel, Notice, StatusBadge } from '../../../shared/molecules/Common'

export default function DriverPreDeparturePage() {
  const state = useDriverData(),
    apis = useApis(),
    action = useDriverAction()
  const [checked, setChecked] = useState(false)
  const load = state.data?.load
  function startRoute() {
    action.runAndNavigate(() => apis.delivery.startRoute(), '/driver/route', 'Route started')
  }
  return (
    <DriverScreen
      title="Check before you leave."
      narrow
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
    >
      {state.data && (
        <>
          <StatusBadge tone="neutral">
            {state.session.vehicleId} · Trip {load?.trip ?? 'unassigned'} · Bay{' '}
            {load?.bay ?? 'unassigned'}
          </StatusBadge>
          <Panel title="From the Loader">
            <div className="panel-body flex min-w-0 flex-col gap-4">
              <p>
                {load?.items.reduce((sum, item) => sum + item.loaded, 0) ?? 0} of{' '}
                {load?.items.reduce((sum, item) => sum + item.expected, 0) ?? 0} cases loaded
              </p>
              <p>
                {load?.completed ? 'Loading and safety checks complete' : 'Loading checks pending'}
              </p>
              <p>{load?.photoId ? 'Loading photo attached' : 'Loading photo required'}</p>
              <StatusBadge>
                {load?.released ? 'Cleared by Dispatcher' : 'Awaiting Dispatcher release'}
              </StatusBadge>
            </div>
          </Panel>
          <Panel title="Your vehicle">
            <div className="panel-body flex min-w-0 flex-col gap-4">
              <p>
                {load?.checks.refrigeration
                  ? 'Refrigeration checked by Loader'
                  : 'Refrigeration check pending'}
              </p>
              <p>Published route and manifest saved for offline use.</p>
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  checked={checked}
                  disabled={state.data.route.started}
                  onCheckedChange={(value) => setChecked(value === true)}
                />
                I checked the assigned load and sealed vehicle doors while safely stopped.
              </label>
            </div>
          </Panel>
          {!load?.released && (
            <Notice title="Waiting for your cleared load">
              Loader must complete checks and attach loading proof, then Dispatcher must release the
              vehicle. Report a problem to the loading team before departure.
            </Notice>
          )}
          <DriverActions>
            {state.data.route.started ? (
              <DriverLink to="/driver/route">Resume current route</DriverLink>
            ) : (
              <Button
                disabled={!checked || !load?.released || action.isPending}
                onClick={startRoute}
              >
                Confirm and start route
              </Button>
            )}
            <DriverLink to="/driver/home" variant="secondary">
              Back to home
            </DriverLink>
          </DriverActions>
          {!checked && !state.data.route.started && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Confirm the vehicle and load check to start.
            </p>
          )}
        </>
      )}
    </DriverScreen>
  )
}
