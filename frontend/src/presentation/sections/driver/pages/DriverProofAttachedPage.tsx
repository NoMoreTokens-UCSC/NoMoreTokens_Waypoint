import { Navigate } from 'react-router-dom'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverHandoffForm } from '../organisms/DriverHandoffForm'
import { DriverLink } from '../molecules/DriverLink'
import { Panel, StatusBadge } from '../../../shared/molecules/Common'

export default function DriverProofAttachedPage() {
  const state = useDriverStop()
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
      {state.draft && state.stop && (
        <DriverHandoffForm
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
