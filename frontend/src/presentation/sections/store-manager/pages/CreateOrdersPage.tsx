import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useStoreAction } from '../lib/useStoreAction'
import { useApis } from '../../../providers/ApisContext'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  ActionLink,
  Callout,
  FieldInput,
  PageIntro,
  Pill,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { cutoffLabel } from '../lib/cutoff'
import { parseForm, useOrderForm, type FieldValues } from '../lib/orderForm'
import { orderKinds, temperatures, totals } from '../lib/orderView'
import { useStoreOrders } from '../lib/useStore'

/** Create orders (before the cutoff) or the cutoff-passed screen (after it). */
export default function CreateOrdersPage() {
  const clock = useBusinessClock()
  return clock.cutoffPassed ? <CutoffPassed /> : <CreateOrders />
}

function CreateOrders() {
  const navigate = useNavigate()
  const clock = useBusinessClock()
  const { orders, outletId } = useStoreOrders()
  const form = useOrderForm(orders)
  const parsed = parseForm(form.values)
  const typed = totals(
    temperatures.map((temperature) => ({
      cases: Number(form.values[temperature].cases) || 0,
      weight: Number(form.values[temperature].weight) || 0,
      volume: Number(form.values[temperature].volume) || 0,
    })),
  )
  const review = () => {
    if (!parsed.valid) {
      toast.error('Check the highlighted quantities and receiving windows.')
      return
    }
    navigate('/store-manager/orders/review')
  }
  const showErrors = form.dirty
  return (
    <StorePage>
      <PageIntro
        title="Create orders"
        context={`Delivery ${formatLongDate(clock.deliveryDate)} · ${outletId}`}
      />
      <Callout title={`Confirm before ${cutoffLabel(clock.cutoff)}`}>
        {outletId} · Fresh only. Create separate dry and chilled orders; check quantities and
        receiving windows.
      </Callout>
      <div className="sm-composer">
        {temperatures.map((temperature) => {
          const kind = orderKinds[temperature]
          const values = form.values[temperature]
          const problems = showErrors ? parsed.errors[temperature] : undefined
          const field = (
            key: keyof FieldValues,
            label: string,
            inputMode?: 'numeric' | 'decimal',
          ) => (
            <FieldInput
              label={label}
              value={values[key]}
              inputMode={inputMode}
              error={problems?.[key]}
              onChange={(event) => form.change(temperature, key, event.target.value)}
            />
          )
          return (
            <section className="sm-card" key={temperature} aria-label={kind.title}>
              <div className="sm-heading-row">
                <ParcelIcon />
                <h2>{kind.title}</h2>
              </div>
              <Pill>{kind.subtitle}</Pill>
              <div className="sm-quantities">
                {field('cases', 'Cases', 'numeric')}
                {field('weight', 'Weight · kg', 'decimal')}
                {field('volume', 'Volume · m³', 'decimal')}
              </div>
              {field('window', 'Receiving window')}
              <p className="sm-note">{kind.rule}</p>
            </section>
          )
        })}
      </div>
      <section className="sm-panel" aria-label="Order totals">
        <div className="sm-totals">
          <Tile size="sm" label="Orders" value={temperatures.length} />
          <Tile size="sm" label="Cases" value={typed.cases} />
          <Tile size="sm" label="Volume" value={`${Number(typed.volume.toFixed(2))} m³`} />
        </div>
        <p className="sm-muted sm-small">Combined weight · {Number(typed.weight.toFixed(2))} kg</p>
        <Action onClick={review}>Review {temperatures.length} orders</Action>
      </section>
    </StorePage>
  )
}

function CutoffPassed() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useStoreAction()
  const clock = useBusinessClock()
  const { orders, outletId } = useStoreOrders()
  const form = useOrderForm(orders)
  const parsed = parseForm(form.values)
  const draft = totals(parsed.inputs)
  const missed = formatWeekday(clock.deliveryDate)
  const next = formatWeekday(clock.nextRunDate)
  useBreadcrumb([{ label: 'Today’s cutoff has passed' }])
  const keepDraft = () => {
    if (!parsed.valid) {
      toast.error('Check the quantities before saving the draft.')
      return
    }
    action.runThen(
      () => apis.orders.saveDrafts(outletId, parsed.inputs),
      () => {
        form.reset()
        navigate('/store-manager/orders/draft')
      },
    )
  }
  return (
    <StorePage>
      <PageIntro
        title="Today’s cutoff has passed"
        context={`${formatLongDate(clock.now)} · ${formatClock(clock.now)} · ${outletId}`}
      />
      <Callout title={`${missed}’s intake is locked`}>
        New or edited orders can no longer enter {missed}’s delivery plan. Your draft has been
        preserved.
      </Callout>
      <section className="sm-panel" aria-label="Draft for the next run">
        <h2>Keep your draft for the next run</h2>
        <p className="sm-muted">
          {draft.orders} draft orders · {draft.cases} cases
          <br />
          Next eligible run: {formatLongDate(clock.nextRunDate)}
          <br />
          Review the date and receiving windows before submitting.
        </p>
        <div className="sm-actions">
          <Action disabled>Confirm for {missed}</Action>
          <Action variant="outline" onClick={keepDraft} disabled={action.isPending}>
            Keep draft for {next}
          </Action>
          <ActionLink variant="outline" to="/store-manager/orders/confirmed">
            View existing confirmed orders
          </ActionLink>
        </div>
        <p className="sm-footnote">
          The closed run remains locked. Returning to a draft does not extend the cutoff.
        </p>
      </section>
    </StorePage>
  )
}
