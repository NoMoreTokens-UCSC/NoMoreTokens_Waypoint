import type { ManagerSignOff } from '../../../domain/deliveryVerification'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { formatTime } from '../lib/utils'

export function ManagerSignOffDetails({
  signature,
  signOff,
}: {
  signature?: Blob
  signOff?: ManagerSignOff
}) {
  const url = useBlobUrl(signature)
  if (!signOff || !url)
    return (
      <p className="text-sm text-destructive">
        Manager sign-off is missing. This record does not verify delivery.
      </p>
    )
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4"
      aria-label="Retained manager sign-off"
    >
      <h2 className="text-sm font-semibold">Store Manager sign-off</h2>
      <p className="text-sm">
        {signOff.managerName} · {formatTime(signOff.signedAt)}
      </p>
      <p className="text-sm [overflow-wrap:anywhere]">{signOff.remarks}</p>
      <ul className="text-sm text-muted-foreground">
        {signOff.orders.map((order) => (
          <li key={order.orderId}>
            {order.orderId} · {order.received} of {order.expected} cases unloaded and checked
          </li>
        ))}
      </ul>
      <img
        src={url}
        alt="Retained Store Manager e-signature"
        className="h-[130px] w-full rounded-md border border-border bg-white object-contain"
      />
    </section>
  )
}
