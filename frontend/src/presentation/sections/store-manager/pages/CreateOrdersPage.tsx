import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useStoreAction } from '../lib/useStoreAction'
import { useApis } from '../../../providers/ApisContext'
import { Switch } from '../../../shared/atoms/switch'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  ActionLink,
  Callout,
  FieldInput,
  OfflineNotice,
  PageIntro,
  Pill,
  StepperField,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { WindowPicker } from '../components/WindowPicker'
import { cutoffLabel } from '../lib/cutoff'
import { parseForm, useOrderForm } from '../lib/orderForm'
import { orderKinds, temperatures, totals } from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { useStoreOrders, useStoreProfile } from '../lib/useStore'
import BrandOrderPage from './BrandOrderPage'

/** Create orders (before the cutoff) or the cutoff-passed screen (after it). */
export default function CreateOrdersPage() {
  const clock = useBusinessClock()
  const { profile, loaded } = useStoreProfile()
  if (!loaded) return null
  // Style and Tech order as one order on their own schedule; the Fresh form is two orders a day.
  if (profile && profile.brand !== 'Fresh') return <BrandOrderPage profile={profile} />
  return clock.cutoffPassed ? <CutoffPassed /> : <CreateOrders />
}

function CreateOrders() {
  const navigate = useNavigate()
  const clock = useBusinessClock()
  const online = useOnline()
  const { orders, outletId, byTemperature } = useStoreOrders()
  const form = useOrderForm(orders)
  const parsed = parseForm(form.values, form.included)
  const placing = temperatures.filter((temperature) => form.included[temperature])
  const typed = totals(
    placing.map((temperature) => ({
      cases: Number(form.values[temperature].cases) || 0,
      weight: Number(form.values[temperature].weight) || 0,
      volume: Number(form.values[temperature].volume) || 0,
    })),
  )
  const review = () => {
    if (!parsed.valid) {
      toast.error(
        placing.length
          ? 'Check the highlighted quantities and receiving windows.'
          : 'Include at least one order to review.',
      )
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
      {!online && <OfflineNotice cutoff={cutoffLabel(clock.cutoff)} />}
      <Callout title={`Confirm before ${cutoffLabel(clock.cutoff)}`}>
        {outletId} · Fresh only. Dry groceries are ordered every operating day; chilled groceries
        only on the days you need them. Check quantities and receiving windows.
      </Callout>
      <div className="sm-composer">
        {temperatures.map((temperature) => {
          const kind = orderKinds[temperature]
          const values = form.values[temperature]
          const included = form.included[temperature]
          const problems = showErrors && included ? parsed.errors[temperature] : undefined
          const existing = byTemperature(temperature)
          return (
            <section
              className={`sm-card${included ? '' : ' sm-card-off'}`}
              key={temperature}
              aria-label={kind.title}
            >
              <div className="sm-heading-row">
                <ParcelIcon />
                <h2>{kind.title}</h2>
                <label className="sm-include">
                  <span>{included ? 'Ordering' : 'Not ordering'}</span>
                  <Switch
                    checked={included}
                    aria-label={`Order ${kind.short.toLowerCase()} groceries for this delivery`}
                    onCheckedChange={(next) => form.setIncluded(temperature, next)}
                  />
                </label>
              </div>
              <Pill>{kind.subtitle}</Pill>
              {included ? (
                <>
                  <div className="sm-quantities">
                    <StepperField
                      label="Cases"
                      unit="case"
                      value={values.cases}
                      error={problems?.cases}
                      onChange={(next) => form.change(temperature, 'cases', next)}
                      onStep={(by) => form.stepCases(temperature, by)}
                    />
                    <FieldInput
                      label="Weight · kg"
                      inputMode="decimal"
                      value={values.weight}
                      error={problems?.weight}
                      onChange={(event) => form.change(temperature, 'weight', event.target.value)}
                    />
                    <FieldInput
                      label="Volume · m³"
                      inputMode="decimal"
                      value={values.volume}
                      error={problems?.volume}
                      onChange={(event) => form.change(temperature, 'volume', event.target.value)}
                    />
                  </div>
                  <p className="sm-note">
                    {values.adjusted
                      ? 'Weight and volume are as you entered them.'
                      : 'Weight and volume follow the number of cases. Change them if you know the exact figures.'}
                  </p>
                  <WindowPicker
                    value={values.window}
                    error={problems?.window}
                    onChange={(next) => form.setWindow(temperature, next)}
                  />
                  <p className="sm-note">{kind.rule}</p>
                </>
              ) : (
                <p className="sm-muted">
                  {existing
                    ? `No change to your ${kind.short.toLowerCase()} order ${existing.id}. It stays as it is.`
                    : `You are not placing a ${kind.short.toLowerCase()} order for this delivery.`}
                </p>
              )}
            </section>
          )
        })}
      </div>
      <section className="sm-panel" aria-label="Order totals">
        <div className="sm-totals">
          <Tile size="sm" label="Orders" value={placing.length} />
          <Tile size="sm" label="Cases" value={typed.cases} />
          <Tile size="sm" label="Volume" value={`${Number(typed.volume.toFixed(2))} m³`} />
        </div>
        <p className="sm-muted sm-small">Combined weight · {Number(typed.weight.toFixed(2))} kg</p>
        <Action onClick={review} disabled={placing.length === 0}>
          {placing.length === 0
            ? 'Choose an order to place'
            : `Review ${placing.length} order${placing.length === 1 ? '' : 's'}`}
        </Action>
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
  const parsed = parseForm(form.values, form.included)
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
          {draft.orders} draft order{draft.orders === 1 ? '' : 's'} · {draft.cases} cases
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
