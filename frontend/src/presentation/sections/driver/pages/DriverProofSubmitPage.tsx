import { useDriverProofActions } from '../hooks/useDriverProofActions'
import { DriverActions } from '../molecules/DriverActions'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { handoffErrors } from '../../../../domain/driverProof'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverLink } from '../molecules/DriverLink'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Modal, Notice, Panel } from '../../../shared/molecules/Common'
import { ManagerSignOffDetails } from '../../../shared/organisms/ManagerSignOffDetails'

export default function DriverProofSubmitPage() {
  const state = useDriverStop()
  const { submitProof, busy } = useDriverProofActions(state)
  const [confirm, setConfirm] = useState(false)
  const errors = state.draft && state.stop ? handoffErrors(state.draft, state.stop.cases) : []
  if (state.draft?.stage === 'captured')
    return <Navigate replace to={state.href('/driver/proof/review')} />
  function openConfirmation() {
    setConfirm(true)
  }
  return (
    <DriverStopLayout state={state} title="Check the handoff." proofStep requireDraft>
      <DriverPhotoPreview photo={state.draft?.photo} fileName={state.draft?.fileName} />
      <ManagerSignOffDetails
        signature={state.draft?.signature}
        signOff={state.draft?.managerSignOff}
      />
      <Panel title="Your record">
        <div className="panel-body">
          <dl className="grid gap-3 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&_dd]:text-right [&_dd]:[overflow-wrap:anywhere]">
            <div>
              <dt>Quantity</dt>
              <dd>
                {state.draft?.quantity} of {state.stop?.cases} cases
              </dd>
            </div>
            <div>
              <dt>Receiver</dt>
              <dd>{state.draft?.acknowledged ? state.draft.receiver : 'Sign-off unavailable'}</dd>
            </div>
            <div>
              <dt>Exception</dt>
              <dd>{state.draft?.exception || 'None'}</dd>
            </div>
            <div>
              <dt>Photo</dt>
              <dd>1 attached locally</dd>
            </div>
          </dl>
        </div>
      </Panel>
      {!!errors.length && (
        <Notice title="Complete the handoff details" tone="danger">
          {errors.join(' ')}
        </Notice>
      )}
      <DriverActions>
        <Button disabled={!!errors.length || busy} onClick={openConfirmation}>
          {state.online ? 'Submit delivery proof' : 'Save with photo offline'}
        </Button>
        <DriverLink to={state.href('/driver/proof/attached')} variant="secondary">
          Edit details
        </DriverLink>
      </DriverActions>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Submitting queues the record. Delivered requires an accepted acknowledgement from the sync
        adapter.
      </p>
      <Modal
        title="Confirm delivery proof submission?"
        description={`${state.draft?.quantity ?? 0} cases · ${state.stop?.outlet}. This demo simulates upload acknowledgement. Manager sign-off is retained with the proof.`}
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open)
        }}
      >
        <Notice
          title={state.online ? 'Ready for demo upload' : 'Save on this device'}
          tone="neutral"
        >
          {state.online
            ? 'The record will upload through the demo adapter.'
            : 'The photo and handoff will remain pending until connectivity returns.'}
        </Notice>
        <DriverActions>
          <Button disabled={busy} onClick={submitProof}>
            {busy ? 'Saving proof…' : 'Confirm submission'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </DriverActions>
      </Modal>
    </DriverStopLayout>
  )
}
