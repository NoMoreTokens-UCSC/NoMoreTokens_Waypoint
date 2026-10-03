import { useDriverIssueForm } from '../hooks/useDriverIssueForm'
import { DriverActions } from '../molecules/DriverActions'
import type { DriverStopState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPicker } from '../molecules/DriverPhotoPicker'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Textarea } from '../../../shared/atoms/textarea'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Field, Panel, Notice, Modal } from '../../../shared/molecules/Common'

export function DriverIssueForm({ state }: { state: DriverStopState }) {
  const {
    kind,
    setKind,
    reason,
    setReason,
    note,
    setNote,
    photo,
    setPhoto,
    parked,
    setParked,
    confirm,
    setConfirm,
    saved,
    setSaved,
    blocked,
    reportIssue,
    busy,
  } = useDriverIssueForm(state)
  return (
    <>
      <Panel title="Report an issue">
        <div className="panel-body flex min-w-0 flex-col gap-4">
          <Field label="Issue type">
            <select
              className="native-select"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value)
                setSaved(false)
              }}
            >
              <option>Cannot deliver</option>
              <option>Delay</option>
              <option>Partial acceptance</option>
            </select>
          </Field>
          {kind === 'Partial acceptance' ? (
            <>
              <Notice title="Record the actual accepted quantity">
                Confirm parking, capture proof, then enter the received case count and the
                rejected-goods exception. Receiver sign-off can be unavailable with a recorded
                reason.
              </Notice>
              <DriverLink to={state.href('/driver/delivery')}>
                Continue to quantity and proof
              </DriverLink>
            </>
          ) : (
            <>
              {kind === 'Cannot deliver' && (
                <Field label="Reason">
                  <select
                    className="native-select"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <option>Outlet closed</option>
                    <option>Receiver unavailable</option>
                    <option>Unsafe access</option>
                    <option>Goods rejected</option>
                    <option>Other</option>
                  </select>
                </Field>
              )}
              <Field label={kind === 'Delay' ? 'Delay details' : 'Attempt details'}>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Describe what happened and where you are safely stopped."
                />
              </Field>
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox checked={parked} onCheckedChange={(value) => setParked(value === true)} />
                I am safely stopped or parked.
              </label>
              {kind === 'Cannot deliver' && (
                <>
                  <DriverPhotoPicker
                    busy={busy || blocked || !parked}
                    onPick={async (file) => {
                      setPhoto(file)
                    }}
                  />
                  {photo && (
                    <DriverPhotoPreview photo={photo} fileName={`${photo.name} · not saved yet`} />
                  )}
                </>
              )}
              <Button
                disabled={
                  blocked ||
                  !parked ||
                  note.trim().length < 4 ||
                  (kind === 'Cannot deliver' && !photo) ||
                  busy
                }
                onClick={() => setConfirm(true)}
              >
                {kind === 'Delay' ? 'Save delay note' : 'Save unsuccessful attempt'}
              </Button>
              {blocked && (
                <Notice title="This stop is not available for a new issue">
                  Start the route first. Sync an existing proof or reopen a completed attempt before
                  recording another handoff.
                </Notice>
              )}
              {saved && (
                <Notice title="Delay saved locally" tone="success">
                  Your note is durable. Dispatch notification and ETA recalculation are not
                  connected in this demo.
                </Notice>
              )}
              {!parked && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Confirm safe parking to unlock reporting.
                </p>
              )}
            </>
          )}
        </div>
      </Panel>
      <Modal
        title={
          kind === 'Delay' ? 'Save this delay note?' : 'Confirm unsuccessful delivery attempt?'
        }
        description="This saves a local record and keeps the delivery incomplete."
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open)
        }}
      >
        <p>
          {kind === 'Delay' ? 'Delay' : reason} · {note}
        </p>
        <DriverActions>
          <Button onClick={reportIssue} disabled={busy}>
            Confirm issue record
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
            Cancel
          </Button>
        </DriverActions>
      </Modal>
    </>
  )
}
