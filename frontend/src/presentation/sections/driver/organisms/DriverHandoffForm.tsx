import { useDriverHandoffForm } from '../hooks/useDriverHandoffForm'
import type { DriverProofDraft } from '../../../../domain/driverProof'
import type { Order } from '../../../../domain/models'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Input } from '../../../shared/atoms/input'
import { Textarea } from '../../../shared/atoms/textarea'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Field, Notice } from '../../../shared/molecules/Common'
import { ReceiverSignaturePad } from '../molecules/ReceiverSignaturePad'

export function DriverHandoffForm({
  draft,
  expected,
  orders,
  next,
}: {
  draft: DriverProofDraft
  expected: number
  orders: Order[]
  next: string
}) {
  const form = useDriverHandoffForm(draft, expected, orders, next)
  return (
    <form onSubmit={form.saveHandoff} className="flex min-w-0 flex-col gap-4">
      <Notice title="Store Manager handoff" tone="neutral">
        Hand the device to the Store Manager to check the unloaded orders, add remarks and sign. Any
        edit to quantities, name or remarks requires a new signature.
      </Notice>
      {orders.map((order) => (
        <Field
          key={order.id}
          label={orders.length === 1 ? 'Cases delivered' : `Cases received for ${order.id}`}
          hint={`${order.id} · Expected: ${order.cases} cases`}
        >
          <Input
            type="number"
            min={0}
            max={order.cases}
            step={1}
            value={form.received[order.id]}
            onChange={(event) => form.updateQuantity(order.id, event.target.value)}
          />
        </Field>
      ))}
      <Field label="Store Manager name">
        <Input
          value={form.receiver}
          onChange={(event) => form.setReceiver(event.target.value)}
          placeholder="Name of the manager receiving the goods"
        />
      </Field>
      <Field
        label="Store Manager remarks"
        hint="Record condition, missing items or confirm that all goods are as expected. Required before signing."
      >
        <Textarea
          aria-label="Store Manager remarks"
          value={form.remarks}
          onChange={(event) => form.setRemarks(event.target.value)}
          placeholder="Example: All 18 cases unloaded and checked in good condition."
        />
      </Field>
      <Field
        label="Quantity or receiver exception"
        hint="Required when the accepted quantity differs from the manifest."
      >
        <Textarea
          value={form.exception}
          onChange={(event) => form.setException(event.target.value)}
          placeholder="Describe rejected, damaged or missing cases."
        />
      </Field>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <Checkbox
          checked={form.acknowledged}
          onCheckedChange={(value) => form.setAcknowledged(value === true)}
        />
        I am the Store Manager. I checked the unloaded orders, received quantities and remarks
        before signing.
      </label>
      <ReceiverSignaturePad
        initial={draft.managerSignOff?.strokes}
        resetKey={form.resetKey}
        valid={form.validSignature}
        onChange={form.captureSignature}
        onClear={form.clearSignature}
      />
      {!!form.errors.length && (
        <ul role="alert" className="text-sm text-destructive">
          {form.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={form.busy}>
        {form.busy ? 'Saving signed handoff…' : 'Continue to submission review'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Manager sign-off is saved on this device when you continue. If the manager cannot sign, save
        an unsuccessful attempt; do not complete the delivery.
      </p>
    </form>
  )
}
