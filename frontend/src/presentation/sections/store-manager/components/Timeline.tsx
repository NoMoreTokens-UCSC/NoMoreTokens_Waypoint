import { formatShortDate } from '../../../../domain/calendar'
import { clock12 } from '../lib/timeText'
import type { Order } from '../../../../domain/models'

const steps = [
  { key: 'placedAt', label: 'Order placed' },
  { key: 'scheduledAt', label: 'Scheduled' },
  { key: 'departedAt', label: 'En route' },
  { key: 'deliveredAt', label: 'Delivered' },
] as const

/** The four steps of an order's journey, each with the time it happened or "Awaiting update". */
export function Timeline({ order }: { order: Order }) {
  return (
    <ol className="sm-timeline">
      {steps.map((step, index) => {
        const at = order[step.key]
        return (
          <li key={step.key} className={`sm-step${at ? '' : ' sm-step-pending'}`}>
            <span className="sm-step-dot" aria-hidden="true">
              {at ? '✓' : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <small>{at ? `${formatShortDate(at)} · ${clock12(at)}` : 'Awaiting update'}</small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
