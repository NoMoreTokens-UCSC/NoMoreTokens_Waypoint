import { useState } from 'react'
import { RotateCcw, FlaskConical } from 'lucide-react'
import { Button } from '../atoms/button'
import { Switch } from '../atoms/switch'
import { Modal, Field, Notice } from '../molecules/Common'
import { useOperations, useAction } from '../../hooks/useOperations'
import { useServices } from '../../providers/ServicesContext'

export function ScenarioPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [confirmReset, setConfirmReset] = useState(false)
  if (!data) return null
  return (
    <Modal
      title="Demo scenarios"
      description="Explore the Figma states using data stored only in this browser."
      open={open}
      onOpenChange={onOpenChange}
    >
      <Notice title="Local frontend simulation" tone="neutral">
        These controls simulate operational states. No real orders, invitations, or dispatches are
        sent.
      </Notice>
      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <strong className="text-sm">Intake cutoff passed</strong>
          <p className="text-xs text-muted-foreground mt-1">
            16:00 · locks store submission and unlocks plan review
          </p>
        </div>
        <Switch
          aria-label="Intake cutoff passed"
          checked={data.settings.cutoffClosed}
          disabled={data.settings.published || action.isPending}
          onCheckedChange={(v) => action.run(() => service.updateSettings({ cutoffClosed: v }))}
        />
      </div>
      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <strong className="text-sm">Simulate offline</strong>
          <p className="text-xs text-muted-foreground mt-1">
            Keep forms and records available; pause sync
          </p>
        </div>
        <Switch
          aria-label="Simulate offline"
          checked={data.settings.simulatedOffline}
          onCheckedChange={(v) => action.run(() => service.updateSettings({ simulatedOffline: v }))}
        />
      </div>
      <Field label="Demo sync outcome">
        <select
          className="native-select"
          value={data.settings.syncOutcome}
          disabled={action.isPending}
          onChange={(e) => {
            const syncOutcome = e.target.value as 'accepted' | 'review' | 'retry'
            action.run(() => service.updateSettings({ syncOutcome }))
          }}
        >
          <option value="accepted">Accept proof</option>
          <option value="retry">Interrupt upload · retry required</option>
          <option value="review">Route review required</option>
        </select>
      </Field>
      <p role="status" className="text-xs text-muted-foreground">
        {action.isPending ? 'Saving scenario…' : 'Scenario settings saved'}
      </p>
      <div className="grid gap-2">
        <Button
          variant="outline"
          disabled={
            action.isPending ||
            !data.loads[0].issue ||
            data.loads[0].issueResolved ||
            data.loads[0].released
          }
          onClick={() =>
            action.run(
              () => service.resolveLoadIssue(data.loads[0].id),
              'Demo Dispatcher decision issued · collect replacement and repeat checks',
            )
          }
        >
          Resolve loading issue · issue revised manifest
        </Button>
        <Button
          variant="outline"
          disabled={action.isPending || data.settings.published}
          onClick={() =>
            action.run(() => service.capacityScenario(), 'Volume constraint scenario enabled')
          }
        >
          <FlaskConical size={16} />
          Capacity exception · ORD1051
        </Button>
        <Button
          variant="outline"
          disabled={action.isPending || data.loads[0].released}
          onClick={() =>
            action.run(
              () =>
                service.reportLoadIssue(
                  data.loads[0].id,
                  'One milk case is missing. Loading held.',
                ),
              'Loading shortfall recorded',
            )
          }
        >
          Missing goods · hold loading
        </Button>
        <Button
          variant="outline"
          disabled={action.isPending}
          onClick={() =>
            action.run(
              () => service.updateSettings({ routeRevision: data.settings.routeRevision + 1 }),
              'Revised route received; previous proof remains saved',
            )
          }
        >
          Route changed while offline
        </Button>
      </div>
      {confirmReset && (
        <Notice title="Reset this browser’s demo?" tone="danger">
          This removes all local demo changes, photographs, and queued records. This action cannot
          be undone.
        </Notice>
      )}
      <div className="flex justify-between items-center border-t pt-4">
        <Button
          variant={confirmReset ? 'destructive' : 'ghost'}
          disabled={action.isPending}
          onClick={() => {
            if (!confirmReset) setConfirmReset(true)
            else
              action.run(async () => {
                await service.repository.reset()
                setConfirmReset(false)
                onOpenChange(false)
              }, 'Demo reset to the Figma sample data')
          }}
        >
          <RotateCcw size={16} />
          {confirmReset ? 'Confirm reset' : 'Reset demo'}
        </Button>
        {confirmReset && (
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
        )}
      </div>
    </Modal>
  )
}
