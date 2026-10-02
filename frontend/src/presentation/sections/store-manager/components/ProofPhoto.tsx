import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../shared/atoms/dialog'
import { BackIcon } from '../../../shared/templates/shellIcons'
import { Action } from './StoreKit'
import { formatClock, formatShortDate } from '../../../../domain/calendar'
import fallback from '../assets/delivery-photo.png'

/** The delivery photograph, or the design's placeholder illustration before a photo is synced. */
export function ProofImage({ url, alt }: { url?: string; alt: string }) {
  return (
    <div className="sm-photo-frame">
      <img src={url ?? fallback} alt={alt} />
    </div>
  )
}

export function ProofDialog({
  open,
  onClose,
  orderId,
  outletId,
  url,
  capturedAt,
}: {
  open: boolean
  onClose: () => void
  orderId: string
  outletId: string
  url?: string
  capturedAt?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm-dialog !gap-4 !rounded-2xl !p-5 sm:!max-w-[380px]"
      >
        <div className="breadcrumbs !mb-0" aria-hidden="true">
          <button type="button" className="breadcrumb-back" onClick={onClose} tabIndex={-1}>
            <BackIcon />
            Back
          </button>
          <span className="breadcrumb-divider" />
          <ol>
            <li>
              <span>Order</span>
            </li>
            <li>
              <span>/</span>
              <span aria-current="page">Proof</span>
            </li>
          </ol>
        </div>
        <DialogTitle className="!text-[22px] !font-semibold">Delivery photograph</DialogTitle>
        <DialogDescription className="sr-only">
          The photograph the driver took when delivering {orderId}.
        </DialogDescription>
        <ProofImage url={url} alt={`Delivery photograph for ${orderId}`} />
        <p className="sm-photo-caption">
          {orderId} · {outletId}
          <br />
          {capturedAt
            ? `Captured by driver · ${formatShortDate(capturedAt)}, ${formatClock(capturedAt)}`
            : 'Captured by driver'}
        </p>
        <Action variant="grey" onClick={onClose}>
          Close
        </Action>
      </DialogContent>
    </Dialog>
  )
}
