import { useState } from 'react'
import type { Evidence } from '../../../../domain/models'
import { Action, Callout } from './StoreKit'
import { ProofDialog } from './ProofPhoto'

/** The signed handoff is also the store's receipt; keep it accessible while upload is pending. */
export function SignedReceipt({
  orderId,
  outletId,
  evidence,
  url,
}: {
  orderId: string
  outletId: string
  evidence: Evidence
  url?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="sm-panel" aria-label="Signed delivery receipt">
      <Callout
        tone={evidence.accepted ? 'success' : 'warning'}
        title="Manager confirmation is already recorded"
      >
        Your quantities, remarks and signature are saved with the delivery photograph.
        {evidence.accepted
          ? ' The delivery upload has been accepted.'
          : ' Upload is pending; the signed receipt remains saved on this device.'}
      </Callout>
      <div className="sm-actions">
        <Action variant="outline" onClick={() => setOpen(true)}>
          View driver evidence
        </Action>
      </div>
      <ProofDialog
        open={open}
        onClose={() => setOpen(false)}
        orderId={orderId}
        outletId={outletId}
        url={url}
        capturedAt={evidence.createdAt}
        evidence={evidence}
      />
    </section>
  )
}
