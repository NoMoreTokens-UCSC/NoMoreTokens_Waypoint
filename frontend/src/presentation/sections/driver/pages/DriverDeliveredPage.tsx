import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverLink } from '../molecules/DriverLink'
import { Notice, Panel } from '../../../shared/molecules/Common'
import { ManagerSignOffDetails } from '../../../shared/organisms/ManagerSignOffDetails'

export default function DriverDeliveredPage() {
  const state = useDriverStop()
  const next = state.data?.stops.find(
    (stop) =>
      stop.id !== state.stop?.id && !['delivered', 'issueReported'].includes(stop.deliveryState),
  )
  return (
    <DriverStopLayout
      state={state}
      title={
        state.proof === 'accepted' ? 'Delivered with photo' : 'Delivery acknowledgement pending'
      }
    >
      {state.proof === 'accepted' ? (
        <>
          <Notice title="Delivery proof accepted by demo adapter" tone="success">
            The simulated acknowledgement was accepted. This is not a real server receipt. The Store
            Manager’s signed quantities and remarks record receipt.
          </Notice>
          <DriverPhotoPreview photo={state.evidence?.photo} fileName={state.evidence?.fileName} />
          <ManagerSignOffDetails
            signature={state.evidence?.signature}
            signOff={state.evidence?.managerSignOff}
          />
          <Panel title="Handoff record">
            <div className="panel-body flex min-w-0 flex-col gap-4">
              <p>
                {state.evidence?.quantity} of{' '}
                {state.evidence?.managerSignOff?.orders.reduce(
                  (total, order) => total + order.expected,
                  0,
                ) ?? state.stop?.cases}{' '}
                cases · {state.stop?.orderIds.join(', ')}
              </p>
              <p>{state.evidence?.receiver || 'Receiver exception recorded'}</p>
              {state.evidence?.receiverException && <p>{state.evidence.receiverException}</p>}
            </div>
          </Panel>
          <DriverActions>
            <DriverLink
              to={next ? `/driver/navigation?stop=${encodeURIComponent(next.id)}` : '/driver/home'}
            >
              {next ? 'Continue to next stop' : 'Finish trip · back to home'}
            </DriverLink>
            <DriverLink to="/driver/sync/history" variant="secondary">
              View sync history
            </DriverLink>
          </DriverActions>
        </>
      ) : (
        <>
          <Notice title="This delivery is still open">
            A captured, attached or locally saved photo cannot mark the delivery complete.
          </Notice>
          <DriverLink to={state.href(state.record ? '/driver/sync' : '/driver/delivery')}>
            View proof status
          </DriverLink>
        </>
      )}
    </DriverStopLayout>
  )
}
