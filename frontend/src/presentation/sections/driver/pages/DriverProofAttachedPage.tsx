import { useSearchParams, Navigate } from 'react-router-dom'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { ManagerHandoffForm } from '../../../shared/organisms/ManagerHandoffForm'
import { DriverButton } from '../atoms/DriverButton'
import { DriverLink } from '../molecules/DriverLink'
import { Panel, StatusBadge, Notice } from '../../../shared/molecules/Common'

export default function DriverProofAttachedPage() {
  const state = useDriverStop()
  const [params, setParams] = useSearchParams()
  const signHere = params.get('sign') === '1' || !!state.draft?.managerSignOff
  if (state.draft?.stage === 'captured')
    return <Navigate replace to={state.href('/driver/proof/review')} />
  return (
    <DriverStopLayout state={state} title="Photo attached · ready to review" proofStep requireDraft>
      <StatusBadge tone="neutral">Photo attached locally · delivery open</StatusBadge>
      <Panel title="Delivery photo">
        <div className="panel-body flex min-w-0 flex-col gap-4">
          <DriverPhotoPreview photo={state.draft?.photo} fileName={state.draft?.fileName} />
          <DriverLink to={state.href('/driver/proof/capture')} variant="secondary">
            Retake photo
          </DriverLink>
        </div>
      </Panel>
      {!signHere && (
        <Notice title="Await Store Manager confirmation" tone="neutral">
          The manager checks received quantities, adds remarks and confirms in their Deliveries
          screen. You do not need a separate order drop-off action. If the manager’s screen is
          unavailable or there is no signal, they can sign on this device.
        </Notice>
      )}
      {!signHere && (
        <DriverButton
          variant="outline"
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('sign', '1')
            setParams(next, { replace: true })
          }}
        >
          Manager signs on this device
        </DriverButton>
      )}
      {signHere && state.draft && state.stop && (
        <ManagerHandoffForm
          key={`${state.stop.id}-${state.draft.fileName}`}
          draft={state.draft}
          expected={state.stop.cases}
          orders={
            state.data?.orders.filter((order) => state.stop?.orderIds.includes(order.id)) ?? []
          }
          next={state.href('/driver/proof/submit')}
        />
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">
        The signed handoff records the Store Manager’s received quantities and remarks.
      </p>
    </DriverStopLayout>
  )
}
