import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatLongDate } from '../../../../domain/calendar'
import { useStoreAction } from '../lib/useStoreAction'
import { useApis } from '../../../providers/ApisContext'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  ActionLink,
  Callout,
  OfflineNotice,
  PageIntro,
  StorePage,
} from '../components/StoreKit'
import { parseForm, useOrderForm } from '../lib/orderForm'
import { orderKinds, quantityText, temperatures, totals } from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { cutoffLabel } from '../lib/cutoff'
import { useStoreOrders } from '../lib/useStore'

/** Review & confirm: one last look at the orders before they are recorded as demand. */
export default function ReviewPage() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useStoreAction()
  const clock = useBusinessClock()
  const online = useOnline()
  const { orders, outletId, loaded, byTemperature } = useStoreOrders()
  const form = useOrderForm(orders)
  const parsed = parseForm(form.values, form.included)
  if (!loaded) return null
  if (!parsed.valid || clock.cutoffPassed) return <Navigate to="/store-manager/orders/new" replace />
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
    if (clock.cutoffPassed) navigate('/store-manager/orders/new')
    else
      toast(
        `Orders are still open · ${clock.minutesToCutoff} minute${clock.minutesToCutoff === 1 ? '' : 's'} left.`,
      )
  }
  return (
    <StorePage>
      <PageIntro
        title="Review & confirm"
        context={`${sum.orders === 1 ? '1 Fresh order' : `${sum.orders} separate Fresh orders`} · ${outletId} · ${formatLongDate(clock.deliveryDate)}`}
      />
      {!online && <OfflineNotice cutoff={cutoffLabel(clock.cutoff)} />}
      <section className="sm-panel" aria-label="Orders to confirm">
        <h2>Everything ready for tomorrow?</h2>
        <p className="sm-muted">
          {sum.cases} cases · {sum.weight} kg · {sum.volume} m³ across{' '}
          {sum.orders === 1 ? 'one Fresh order record' : 'two Fresh order records'}
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
        {temperatures
          .filter((temperature) => !form.included[temperature])
          .map((temperature) => {
            const kind = orderKinds[temperature]
            const existing = byTemperature(temperature)
            return (
              <p className="sm-note" key={temperature}>
                Not included: {kind.title}
                {existing ? ` · your order ${existing.id} stays as it is.` : '.'}
              </p>
            )
          })}
      </section>
      <Callout title="Allocation follows the cutoff">
        Confirming records demand. A vehicle and ETA become available after the dispatcher publishes
        the plan.
      </Callout>
      <div className="sm-actions">
        <Action onClick={confirm} disabled={action.isPending}>
          Confirm {sum.orders} order{sum.orders === 1 ? '' : 's'}
        </Action>
        <ActionLink variant="outline" to="/store-manager/orders/new">
          Edit quantities
        </ActionLink>
        <Action variant="outline" onClick={checkCutoff}>
          Check cutoff status
        </Action>
      </div>
    </StorePage>
  )
}
