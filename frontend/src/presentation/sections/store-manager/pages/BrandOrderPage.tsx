import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLongDate } from '../../../../domain/calendar'
import type { OutletProfile } from '../../../../domain/outlets'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  Callout,
  OfflineNotice,
  PageIntro,
  Pill,
  StepperField,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { WindowPicker } from '../components/WindowPicker'
import { cutoffLabel } from '../lib/cutoff'
import { countText, kindOf, quantityText, windowEnd } from '../lib/orderView'
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
  return loaded ? <BrandOrderForm profile={profile} /> : null
}

function BrandOrderForm({ profile }: { profile: OutletProfile }) {
  const brand = profile.brand as 'Style' | 'Tech'
  const navigate = useNavigate()
  const action = useStoreAction()
  const clock = useBusinessClock()
  const online = useOnline()
  const { orders } = useStoreOrders()
  const existing = orders[0]
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
          },
        ],
      },
      `Confirm ${brand} order`,
      () => navigate('/store-manager/orders/confirmed'),
    )
  }
  return (
    <StorePage>
      <PageIntro
        title={brand === 'Style' ? 'Weekly order' : 'Create order'}
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
        <StepperField
          label={brand === 'Style' ? 'Cartons' : 'Items'}
          unit={sizes.unit}
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
          {existing &&
            ` You already have ${existing.id} (${quantityText(existing)}); confirming replaces it.`}
        </p>
      </section>
      <div className="sm-actions">
        {clock.cutoffPassed ? (
          <Callout title="Today’s cutoff has passed">
            Place this order before {cutoffLabel(clock.cutoff)} for the next delivery.
          </Callout>
        ) : (
          <Action onClick={place} disabled={action.isPending}>
            Confirm {countText(units, { brand })} order
          </Action>
        )}
      </div>
    </StorePage>
  )
}
