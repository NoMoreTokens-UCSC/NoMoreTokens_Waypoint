import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverLink } from '../molecules/DriverLink'
import { Panel, Notice } from '../../../shared/molecules/Common'

export default function DriverArrivalPage() {
  const state = useDriverStop()
  return (
    <DriverStopLayout state={state} title="Arrived and safely parked" proofStep>
      <Notice title="Safe parking confirmed" tone="success">
        You can now record the handoff. A photograph and Store Manager confirmation are required.
      </Notice>
      <Panel title={`You’re at ${state.stop?.outlet}`}>
        <div className="panel-body flex min-w-0 flex-col gap-4">
          <p>
            {state.stop?.cases} cases to deliver · {state.stop?.orderIds.join(', ')}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The Store Manager checks unloading, adds remarks and signs before delivery completion.
          </p>
        </div>
      </Panel>
      <DriverActions>
        <DriverLink to={state.href('/driver/proof/capture')}>Capture delivery photo</DriverLink>
        <DriverLink to={state.href('/driver/issues')} variant="secondary">
          Something is wrong
        </DriverLink>
      </DriverActions>
    </DriverStopLayout>
  )
}
