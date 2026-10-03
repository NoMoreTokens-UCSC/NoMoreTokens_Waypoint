import type { DriverStopState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from '../hooks/useDriverAction'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Panel, EmptyState } from '../../../shared/molecules/Common'

export function DriverReportedIssue({ state }: { state: DriverStopState }) {
  const apis = useApis(),
    action = useDriverAction()
  const issue =
    state.evidence?.kind === 'attempt' ? state.evidence.receiverException : state.stop?.issue
  function retryStop() {
    if (!state.stop) return
    const stopId = state.stop.id
    action.runAndNavigate(
      () => apis.delivery.retryStop(stopId),
      state.href('/driver/navigation'),
      'Stop reopened. Previous evidence retained.',
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel title="Recorded issue">
        <div className="panel-body flex min-w-0 flex-col gap-4">
          {issue ? (
            <>
              <p>{issue}</p>
              {state.evidence?.kind === 'attempt' && (
                <DriverPhotoPreview
                  photo={state.evidence.photo}
                  fileName={state.evidence.fileName}
                />
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {state.evidence?.kind === 'attempt'
                  ? 'This unsuccessful attempt did not complete delivery.'
                  : 'Delay note does not complete or cancel delivery.'}
              </p>
              {state.evidence?.kind === 'attempt' && state.evidence.id !== state.stop?.proofId && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Historical attempt · current stop status: {state.stop?.status}.
                </p>
              )}
              {state.stop?.status === 'Cannot deliver' &&
                state.evidence?.id === state.stop.proofId && (
                  <Button
                    variant="outline"
                    onClick={retryStop}
                    disabled={
                      action.isPending || (!!state.record && state.record.status !== 'accepted')
                    }
                  >
                    Retry delivery stop
                  </Button>
                )}
            </>
          ) : (
            <EmptyState title="No issue for this stop" />
          )}
          <DriverLink to="/driver/sync" variant="outline">
            Saved evidence & retries
          </DriverLink>
        </div>
      </Panel>
      <DriverLink to="/driver/route" variant="secondary">
        Back to current route
      </DriverLink>
    </div>
  )
}
