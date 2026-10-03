import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { defaultWindow, type Brand, type Parking } from '../../../../domain/outlets'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, Btn, Card, CardLabel, Field, Pill } from '../components/AdminKit'
import { brands, minutesOf, parkingOptions, time12, timeOptions, useOutlets } from '../lib/outlets'

const depots = ['Peliyagoda', 'Kandy']

interface Draft {
  name: string
  district: string
  brand: Brand
  depot: string
  parking: Parking
  earliest: string
  latest: string
}
type Errors = Partial<Record<'name' | 'district' | 'window', string>>

/** Add outlet: the store, its brand, which depot serves it and when deliveries may arrive. */
export default function AddOutletPage() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useAction()
  const { outlets } = useOutlets()
  const [draft, setDraft] = useState<Draft>({
    name: '',
    district: '',
    brand: 'Fresh',
    depot: 'Peliyagoda',
    parking: 'normal',
    ...defaultWindow('Fresh'),
  })
  const [attempted, setAttempted] = useState(false)
  useBreadcrumb([{ label: 'Outlets', to: '/administration/outlets' }, { label: 'Add outlet' }])

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const check = (): Errors => {
    const errors: Errors = {}
    const name = draft.name.trim()
    if (name.length < 3) errors.name = 'Enter the outlet name.'
    else if (outlets.some((outlet) => outlet.name.toLowerCase() === name.toLowerCase()))
      errors.name = 'An outlet with this name already exists.'
    if (draft.district.trim().length < 2) errors.district = 'Enter the district.'
    if (minutesOf(draft.latest) - minutesOf(draft.earliest) < 60)
      errors.window = 'Allow at least an hour between the earliest and latest delivery.'
    return errors
  }
  const errors = attempted ? check() : {}
  const highest = Math.max(
    0,
    ...outlets.map((outlet) => Number(/^OUT(\d+)$/.exec(outlet.id)?.[1] ?? 0)),
  )
  const nextId = `OUT${String(highest + 1).padStart(3, '0')}`
  const mall = draft.parking === 'mall_dock'

  const save = () => {
    setAttempted(true)
    if (Object.keys(check()).length) {
      toast.error('Check the highlighted details.')
      return
    }
    action.run(async () => {
      const created = await apis.outlets.createOutlet(draft)
      toast.success(`${created.name} was added as ${created.id}`)
      navigate(`/administration/outlets/${created.id}`)
    })
  }

  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Outlets"
        title="Add outlet"
        lead="Add a store to the network. Once it exists you can assign a store manager to it."
      />
      <div className="ad-compose">
        <div className="ad-stack">
          <Card label="Brand">
            <CardLabel>Step 1 · Brand</CardLabel>
            <div className="ad-role-grid" role="radiogroup" aria-label="Brand">
              {brands.map(({ brand, summary }) => (
                <button
                  key={brand}
                  type="button"
                  role="radio"
                  aria-checked={draft.brand === brand}
                  aria-pressed={draft.brand === brand}
                  className="ad-role-card"
                  onClick={() => change({ brand, ...defaultWindow(brand) })}
                >
                  <strong>Waypoint {brand}</strong>
                  <span>{summary}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card label="Details">
            <CardLabel>Step 2 · Details</CardLabel>
            <div className="ad-form-grid">
              <Field label="Outlet name" error={errors.name} hint="For example Fresh Wattala.">
                <input
                  value={draft.name}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.name)}
                  onChange={(event) => change({ name: event.target.value })}
                />
              </Field>
              <Field label="District" error={errors.district} hint="Where the outlet is.">
                <input
                  value={draft.district}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.district)}
                  onChange={(event) => change({ district: event.target.value })}
                />
              </Field>
              <Field label="Depot" hint="The depot that delivers to this outlet.">
                <select
                  value={draft.depot}
                  onChange={(event) => change({ depot: event.target.value })}
                >
                  {depots.map((depot) => (
                    <option key={depot}>{depot}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
          <Card label="Deliveries">
            <CardLabel>Step 3 · Deliveries</CardLabel>
            <div className="ad-options" role="radiogroup" aria-label="Access">
              {parkingOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.parking === option.value}
                  className="ad-option"
                  onClick={() => change({ parking: option.value })}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <span className="ad-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="ad-form-grid">
              <Field
                label={mall ? 'Mall opens deliveries at' : 'Earliest delivery'}
                error={errors.window}
              >
                <select
                  value={draft.earliest}
                  aria-invalid={Boolean(errors.window)}
                  onChange={(event) => change({ earliest: event.target.value })}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time12(time)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={mall ? 'Mall stops deliveries at' : 'Latest delivery'}
                hint={
                  draft.brand === 'Fresh'
                    ? 'Fresh goods must arrive before the store opens.'
                    : mall
                      ? 'Orders can only be placed inside this window.'
                      : 'Store managers choose their receiving window inside these hours.'
                }
              >
                <select
                  value={draft.latest}
                  aria-invalid={Boolean(errors.window)}
                  onChange={(event) => change({ latest: event.target.value })}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time12(time)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
        </div>
        <div className="ad-stack">
          <Card label="Summary">
            <CardLabel>Summary</CardLabel>
            <dl className="ad-rows">
              <div>
                <dt>Outlet ID</dt>
                <dd>{nextId}</dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{draft.name.trim() || '—'}</dd>
              </div>
              <div>
                <dt>Deliveries</dt>
                <dd>
                  {time12(draft.earliest)} – {time12(draft.latest)}
                </dd>
              </div>
            </dl>
            <div className="ad-chips">
              <Pill>{draft.brand}</Pill>
              <Pill>{draft.depot}</Pill>
              <Pill>{parkingOptions.find((o) => o.value === draft.parking)?.label}</Pill>
            </div>
          </Card>
          <div className="ad-actions">
            <Btn onClick={save} disabled={action.isPending}>
              Add outlet
            </Btn>
            <Btn variant="grey" onClick={() => navigate('/administration/outlets')}>
              Cancel
            </Btn>
            <p className="ad-note">The outlet ID is assigned when you add it.</p>
          </div>
        </div>
      </div>
    </AdminPage>
  )
}
