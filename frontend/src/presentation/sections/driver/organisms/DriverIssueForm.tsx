import { useDriverIssueForm } from '../hooks/useDriverIssueForm'
import { DriverActions } from '../molecules/DriverActions'
import type { DriverStopState } from '../hooks/useDriverData'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPicker } from '../molecules/DriverPhotoPicker'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Input } from '../../../shared/atoms/input'
import { Textarea } from '../../../shared/atoms/textarea'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Field, Panel, Notice, Modal } from '../../../shared/molecules/Common'

export function DriverIssueForm({ state }: { state: DriverStopState }) {
  const {
    kind,
    setKind,
    revisedEta,
    setRevisedEta,
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
  const isDelay = kind === 'Delay' || kind === 'Vehicle breakdown'
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
              <option>Vehicle breakdown</option>
              <option>Partial acceptance</option>
            </select>
          </Field>
          {kind === 'Partial acceptance' ? (
            <>
              <Notice title="Record the actual accepted quantity">
                Confirm parking, capture proof, then enter the received case count and the
                rejected-goods exception. The Store Manager must review received quantities, add
                remarks and sign. If nobody can confirm receipt, record an unsuccessful attempt.
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
              <Field label={isDelay ? 'Delay details' : 'Attempt details'}>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Describe what happened and where you are safely stopped."
                />
              </Field>
              {isDelay && (
                <>
                  <Field
                    label="Revised estimated arrival"
                    hint={
                      state.stop?.status === 'Arrived'
                        ? 'Arrival is already recorded; explain unloading delays in the note.'
                        : 'Optional driver estimate. Dispatch must confirm any route or receiving-window change.'
                    }
                  >
                    <Input
                      type="time"
                      value={revisedEta}
                      onChange={(event) => setRevisedEta(event.target.value)}
                      disabled={state.stop?.status === 'Arrived'}
                    />
                  </Field>
                  <Notice
                    title={
                      kind === 'Vehicle breakdown'
                        ? 'Keep the delivery open while dispatch resolves the breakdown'
                        : 'A delay does not cancel this delivery'
                    }
                  >
                    If Fresh delivery will miss 08:00, contact dispatch and the outlet manager. Save
                    the reason and your estimate; dispatch must arrange a replacement or agree a new
                    receiving plan. The deadline is not extended here.
                  </Notice>
                </>
              )}
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
                {isDelay
                  ? kind === 'Vehicle breakdown'
                    ? 'Save breakdown report'
                    : 'Save delay note'
                  : 'Save unsuccessful attempt'}
              </Button>
              {blocked && (
                <Notice title="This stop is not available for a new issue">
                  Start the route first. Sync an existing proof or reopen a completed attempt before
                  recording another handoff.
                </Notice>
              )}
              {saved && (
                <Notice title="Delay saved locally" tone="success">
                  Your report and any revised estimate are saved. Remote dispatch and outlet
                  notifications await the backend.
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
          isDelay
            ? 'Save this delay or breakdown report?'
            : 'Confirm unsuccessful delivery attempt?'
        }
        description="This saves a local record and keeps the delivery incomplete."
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open)
        }}
      >
        <p>
          {isDelay ? kind : reason} · {note}
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
