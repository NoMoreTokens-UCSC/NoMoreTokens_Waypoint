import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatLongDate } from '../../../../domain/calendar'
import { useStoreAction } from '../lib/useStoreAction'
import { useApis } from '../../../providers/ApisContext'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { Action, ActionLink, Callout, PageIntro, StorePage } from '../components/StoreKit'
import { parseForm, useOrderForm } from '../lib/orderForm'
import { orderKinds, quantityText, totals } from '../lib/orderView'
import { useStoreOrders } from '../lib/useStore'

/** Review & confirm: one last look at both orders before they are recorded as demand. */
export default function ReviewPage() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useStoreAction()
  const clock = useBusinessClock()
  const { orders, outletId, loaded } = useStoreOrders()
  const form = useOrderForm(orders)
  const parsed = parseForm(form.values)
  if (!loaded) return null
  if (!parsed.valid || clock.cutoffPassed) return <Navigate to="/store-manager/orders" replace />
  const sum = totals(parsed.inputs)
  const confirm = () =>
    action.runThen(
      () => apis.orders.placeOrders(outletId, parsed.inputs),
      () => {
        form.reset()
        navigate('/store-manager/orders/confirmed')
      },
    )
  const checkCutoff = () => {
    if (clock.cutoffPassed) navigate('/store-manager/orders')
    else
      toast(
        `Orders are still open · ${clock.minutesToCutoff} minute${clock.minutesToCutoff === 1 ? '' : 's'} left.`,
      )
  }
  return (
    <StorePage>
      <PageIntro
        title="Review & confirm"
        context={`${sum.orders} separate Fresh orders · ${outletId} · ${formatLongDate(clock.deliveryDate)}`}
      />
      <section className="sm-panel" aria-label="Orders to confirm">
        <h2>Everything ready for tomorrow?</h2>
        <p className="sm-muted">
          {sum.cases} cases · {sum.weight} kg · {sum.volume} m³ across two Fresh order records
        </p>
        {parsed.inputs.map((input) => {
          const kind = orderKinds[input.temperature]
          return (
            <div className="sm-review-row" key={input.temperature}>
              <div>
                <strong>{kind.title}</strong>
                <small>{kind.subtitle}</small>
              </div>
              <span className="sm-details">{quantityText(input)}</span>
              <span className="sm-window">
                {input.window}–{input.windowEnd}
              </span>
            </div>
          )
        })}
      </section>
      <Callout title="Allocation follows the cutoff">
        Confirming records demand. A vehicle and ETA become available after the dispatcher publishes
        the plan.
      </Callout>
      <div className="sm-actions">
        <Action onClick={confirm} disabled={action.isPending}>
          Confirm {sum.orders} orders
        </Action>
        <ActionLink variant="outline" to="/store-manager/orders">
          Edit quantities
        </ActionLink>
        <Action variant="outline" onClick={checkCutoff}>
          Check cutoff status
        </Action>
      </div>
    </StorePage>
  )
}
