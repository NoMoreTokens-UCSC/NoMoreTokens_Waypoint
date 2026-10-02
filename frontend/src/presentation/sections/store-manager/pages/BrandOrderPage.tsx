import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useApis } from '../../../providers/ApisContext'
import type { OutletProfile } from '../../../../domain/outlets'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  Callout,
  OfflineNotice,
  PlannedNotice,
  ReplaceNotice,
  PageIntro,
  Pill,
  StepperField,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { WindowPicker } from '../components/WindowPicker'
import { cutoffLabel } from '../lib/cutoff'
import { countText, kindOf, quantityText, windowEnd, windowText } from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { useStoreOrders } from '../lib/useStore'
import { useStoreAction } from '../lib/useStoreAction'
import { formatWindow, parseWindow, windowProblem } from '../lib/windows'

/** Typical size of one unit, so weight and volume follow the count. Style fills volume before weight. */
const perUnit = {
  Style: { kg: 7, m3: 0.18, unit: 'carton', first: 40 },
  Tech: { kg: 45, m3: 0.55, unit: 'item', first: 1 },
} as const

const clampCount = (text: string) => Math.max(0, Math.min(100, Math.trunc(Number(text) || 0)))

/**
 * Create an order for a Style or Tech outlet. Fresh orders daily in two parts; Style orders once a
 * week for its scheduled day (in a mall, only inside the mall's access window); Tech orders as
 * needed, often one large, fragile item. Each is a single order with its own limits.
 */
export default function BrandOrderPage({ profile }: { profile: OutletProfile }) {
  const { loaded } = useStoreOrders()
  // The form starts from the outlet's current order, so wait until it is known.
  const changing = useSearchParams()[0].get('order') ?? 'new'
  // A different order being changed starts the form again.
  return loaded ? <BrandOrderForm key={changing} profile={profile} /> : null
}

function BrandOrderForm({ profile }: { profile: OutletProfile }) {
  const brand = profile.brand as 'Style' | 'Tech'
  const navigate = useNavigate()
  const apis = useApis()
  const action = useStoreAction()
  const clock = useBusinessClock()
  const online = useOnline()
  const { orders } = useStoreOrders()
  const changingId = useSearchParams()[0].get('order')
  // Tech orders stand alone: the form adds a new order, or changes the one picked from the list.
  // Style has one weekly order, which the form replaces.
  const existing = brand === 'Tech' ? orders.find((order) => order.id === changingId) : orders[0]
  const sizes = perUnit[brand]
  const [count, setCount] = useState(String(existing?.cases ?? sizes.first))
  const [window, setWindow] = useState(
    existing
      ? formatWindow(existing.window, windowEnd(existing))
      : brand === 'Style'
        ? formatWindow(profile.receiving.earliest, '07:30')
        : formatWindow('09:00', '11:00'),
  )
  const [acknowledged, setAcknowledged] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const units = clampCount(count)
  const weight = Math.round(units * sizes.kg)
  const volume = Number((units * sizes.m3).toFixed(2))
  const windowError = windowProblem(window, profile.receiving)
  const errors = {
    count: units < 1 ? `Enter 1 to 100 ${sizes.unit}s.` : undefined,
    window: windowError,
    care:
      brand === 'Tech' && !acknowledged
        ? 'Confirm that staff will be there to inspect and sign.'
        : undefined,
  }
  const valid = !errors.count && !errors.window && !errors.care
  const kind = kindOf({ brand, temperature: 'Ambient' })
  const place = () => {
    setAttempted(true)
    if (!valid) return
    const parsed = parseWindow(window)!
    action.send(
      {
        kind: 'orders',
        inputs: [
          {
            temperature: 'Ambient',
            cases: units,
            weight,
            volume,
            window: parsed.start,
            windowEnd: parsed.end,
            orderId: brand === 'Tech' ? existing?.id : undefined,
          },
        ],
      },
      existing && brand === 'Tech' ? `Change order ${existing.id}` : `Confirm ${brand} order`,
      () => navigate('/store-manager/orders/confirmed'),
    )
  }
  // After the cutoff the order cannot join tomorrow's plan; it is kept as a draft for the next run.
  const keepDraft = () => {
    setAttempted(true)
    if (!valid) return
    const parsed = parseWindow(window)!
    action.runThen(
      () =>
        apis.orders.saveDrafts(profile.id, [
          {
            temperature: 'Ambient',
            cases: units,
            weight,
            volume,
            window: parsed.start,
            windowEnd: parsed.end,
          },
        ]),
      () => navigate('/store-manager/orders/draft'),
    )
  }
  return (
    <StorePage>
      <PageIntro
        title={brand === 'Style' ? 'Weekly order' : existing ? 'Change order' : 'Create order'}
        context={`${profile.id} · ${profile.name} · Delivery ${formatLongDate(clock.deliveryDate)}`}
      />
      {!online && <OfflineNotice cutoff={cutoffLabel(clock.cutoff)} />}
      <Callout title={`Confirm before ${cutoffLabel(clock.cutoff)}`}>
        {profile.schedule}.
        {profile.mall &&
          ' This outlet is in a mall, which only accepts deliveries in its access window.'}
      </Callout>
      {brand === 'Tech' && (
        <Callout tone="danger" title="Fragile and high value">
          Appliances travel as their own stop and need someone to inspect and sign for them on
          arrival.
        </Callout>
      )}
      {brand === 'Tech' && orders.length > 0 && (
        <section className="sm-panel" aria-label="Orders for this delivery">
          <h2 className="sm-h22">Already ordered for this delivery</h2>
          <ul className="sm-feed">
            {orders.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>
                    {order.pendingSync && order.id.startsWith('PENDING')
                      ? 'New order (waiting to send)'
                      : order.id}
                  </strong>
                  <small>
                    {quantityText(order)} · {windowText(order)}
                  </small>
                </div>
                {!order.pendingSync && ['Confirmed', 'Allocated'].includes(order.status) && (
                  <Link className="sm-feed-link" to={`/store-manager/orders/new?order=${order.id}`}>
                    Change
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="sm-muted sm-small">
            Each order is separate. Add as many as you need before the cutoff.
          </p>
        </section>
      )}
      <section className="sm-card" aria-label={kind.title}>
        <div className="sm-widget-head">
          <div>
            <h3>{kind.title}</h3>
            <p>{kind.subtitle}</p>
          </div>
          <span className="sm-widget-status">
            <Pill tone="amber">{brand === 'Style' ? 'Weekly' : 'As needed'}</Pill>
          </span>
        </div>
        {brand === 'Tech' && !existing && orders.length > 0 && (
          <p className="sm-planned" role="note">
            <Pill tone="green">New order</Pill>
            <span>
              This is added beside your {orders.length} existing order
              {orders.length === 1 ? '' : 's'}; they are not changed.
            </span>
          </p>
        )}
        {existing && <ReplaceNotice order={existing} change={brand === 'Tech'} />}
        {existing?.status === 'Allocated' && <PlannedNotice />}
        <StepperField
          label={brand === 'Style' ? 'Cartons' : 'Items'}
          unit={sizes.unit}
          narrow
          value={count}
          error={attempted ? errors.count : undefined}
          onChange={(value) => setCount(value.replace(/\D/g, ''))}
          onStep={(by) => setCount(String(Math.max(0, Math.min(100, units + by))))}
        />
        <WindowPicker
          label={profile.mall ? 'Mall delivery window' : 'Receiving window'}
          value={window}
          limits={profile.receiving}
          error={attempted ? errors.window : undefined}
          onChange={setWindow}
        />
        {brand === 'Tech' && (
          <label className="sm-confirm-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            Staff will be available to inspect and sign for the delivery.
          </label>
        )}
        {attempted && errors.care && (
          <small role="alert" className="sm-window-error">
            {errors.care}
          </small>
        )}
        <div className="sm-pair">
          <Tile size="md" label="Estimated weight" value={`${weight} kg`} />
          <Tile size="md" label="Estimated volume" value={`${volume} m³`} />
        </div>
        <p className="sm-note">
          Estimated from typical {brand === 'Style' ? 'garments and cartons' : 'appliances'}; the
          dispatcher confirms the load.
        </p>
      </section>
      <div className="sm-actions">
        {clock.cutoffPassed ? (
          <>
            <Callout title="Today’s cutoff has passed">
              {formatWeekday(clock.deliveryDate)}’s intake is locked. Keep this order as a draft and
              confirm it for the next run.
            </Callout>
            <Action variant="outline" onClick={keepDraft} disabled={action.isPending}>
              Keep draft for {formatWeekday(clock.nextRunDate)}
            </Action>
          </>
        ) : (
          <Action onClick={place} disabled={action.isPending}>
            {brand === 'Tech'
              ? existing
                ? `Save changes to ${existing.id}`
                : orders.length
                  ? `Add ${countText(units, { brand })} order`
                  : `Confirm ${countText(units, { brand })} order`
              : `Confirm ${countText(units, { brand })} order`}
          </Action>
        )}
      </div>
    </StorePage>
  )
}
