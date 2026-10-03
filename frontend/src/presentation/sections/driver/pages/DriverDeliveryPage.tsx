import { DriverActions } from '../molecules/DriverActions'
import { Navigate } from 'react-router-dom'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverLink } from '../molecules/DriverLink'
import { Notice } from '../../../shared/molecules/Common'

/** Stable entry URL resumes the durable step for the selected stop. */
export default function DriverDeliveryPage() {
  const state = useDriverStop()
  if (state.stop && !state.isPending) {
    if (state.proof === 'accepted') return <Navigate replace to={state.href('/driver/delivered')} />
    if (state.stop.status === 'Cannot deliver' && state.record?.status === 'accepted')
      return <Navigate replace to={state.href('/driver/issues')} />
    if (state.record) return <Navigate replace to={state.href('/driver/sync')} />
    if (state.draft)
      return (
        <Navigate
          replace
          to={state.href(
            state.draft.stage === 'attached' ? '/driver/proof/attached' : '/driver/proof/review',
          )}
        />
      )
    if (state.stop.status === 'Arrived')
      return <Navigate replace to={state.href('/driver/arrival')} />
  }
  return (
    <DriverStopLayout state={state} title="Delivery proof">
      <Notice title="Arrive and park before recording evidence">
        Open navigation to confirm you are safely stopped at this outlet.
      </Notice>
      <DriverActions>
        <DriverLink to={state.href('/driver/navigation')}>Open navigation</DriverLink>
        <DriverLink to={state.href('/driver/issues')} variant="secondary">
          View delivery issues
        </DriverLink>
      </DriverActions>
    </DriverStopLayout>
  )
}
