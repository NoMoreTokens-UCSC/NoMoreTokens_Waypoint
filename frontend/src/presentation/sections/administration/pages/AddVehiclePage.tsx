import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { defaultCapacity } from '../../../../domain/fleet'
import type { Vehicle } from '../../../../domain/models'
import type { Brand } from '../../../../domain/outlets'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, Btn, Card, CardLabel, Field, Pill } from '../components/AdminKit'
import { brands } from '../lib/outlets'
import { useVehicles, vehicleTypes } from '../lib/vehicles'

const depots = ['Peliyagoda', 'Kandy']

interface Draft {
  brand: Brand
  type: Vehicle['type']
  reefer: boolean
  depot: string
  registration: string
  weight: string
  volume: string
}
type Errors = Partial<Record<'registration' | 'weight' | 'volume', string>>

/** Add vehicle: brand, type and refrigeration, depot and what it can carry. */
export default function AddVehiclePage() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useAction()
  const { vehicles } = useVehicles()
  const [draft, setDraft] = useState<Draft>({
    brand: 'Fresh',
    type: 'Truck',
    reefer: false,
    depot: 'Peliyagoda',
    registration: '',
    weight: String(defaultCapacity('Truck').weight),
    volume: String(defaultCapacity('Truck').volume),
  })
  const [attempted, setAttempted] = useState(false)
  useBreadcrumb([{ label: 'Vehicles', to: '/administration/vehicles' }, { label: 'Add vehicle' }])

  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const check = (): Errors => {
    const errors: Errors = {}
    const weight = Number(draft.weight)
    const volume = Number(draft.volume)
    if (!Number.isFinite(weight) || weight < 100 || weight > 20000)
      errors.weight = 'Between 100 and 20,000 kg.'
    if (!Number.isFinite(volume) || volume < 1 || volume > 60)
      errors.volume = 'Between 1 and 60 m³.'
    const registration = draft.registration.trim().toUpperCase()
    if (registration && !/^[A-Z0-9][A-Z0-9 -]{3,11}$/.test(registration))
      errors.registration = '4 to 12 letters, numbers, spaces or dashes.'
    else if (registration && vehicles.some((vehicle) => vehicle.registration === registration))
      errors.registration = 'That registration is already on a vehicle.'
    return errors
  }
  const errors = attempted ? check() : {}
  const highest = Math.max(
    0,
    ...vehicles.map((vehicle) => Number(/^VEH(\d+)$/.exec(vehicle.id)?.[1] ?? 0)),
  )
  const nextId = `VEH${String(highest + 1).padStart(3, '0')}`
  const kind = vehicleTypes.find(
    (option) => option.type === draft.type && option.reefer === draft.reefer,
  )

  const pickBrand = (brand: Brand) =>
    // Only Fresh carries chilled goods, so any other brand is a dry vehicle.
    change({ brand, reefer: brand === 'Fresh' ? draft.reefer : false })
  const pickType = (type: Vehicle['type'], reefer: boolean) => {
    const capacity = defaultCapacity(type)
    change({ type, reefer, weight: String(capacity.weight), volume: String(capacity.volume) })
  }
  const save = () => {
    setAttempted(true)
    if (Object.keys(check()).length) {
      toast.error('Check the highlighted details.')
      return
    }
    action.run(async () => {
      const created = await apis.fleet.createVehicle({
        brand: draft.brand,
        type: draft.type,
        reefer: draft.reefer,
        depot: draft.depot,
        weightCapacity: Number(draft.weight),
        volumeCapacity: Number(draft.volume),
        registration: draft.registration.trim() || undefined,
      })
      toast.success(`${created.id} was added to the fleet`)
      navigate(`/administration/vehicles/${created.id}`)
    })
  }

  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Vehicles"
        title="Add vehicle"
        lead="Add a vehicle to the fleet. The dispatcher can plan with it straight away."
      />
      <div className="ad-compose">
        <div className="ad-stack">
          <Card label="Brand">
            <CardLabel>Step 1 · Brand</CardLabel>
            <div className="ad-role-grid" role="radiogroup" aria-label="Brand">
              {brands.map(({ brand }) => (
                <button
                  key={brand}
                  type="button"
                  role="radio"
                  aria-checked={draft.brand === brand}
                  aria-pressed={draft.brand === brand}
                  className="ad-role-card"
                  onClick={() => pickBrand(brand)}
                >
                  <strong>Waypoint {brand}</strong>
                  <span>
                    {brand === 'Fresh'
                      ? 'Can be refrigerated for chilled goods.'
                      : 'Dry goods only; not refrigerated.'}
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <Card label="Vehicle type">
            <CardLabel>Step 2 · Vehicle type</CardLabel>
            <div className="ad-role-grid" role="radiogroup" aria-label="Vehicle type">
              {vehicleTypes.map((option) => {
                const blocked = option.reefer && draft.brand !== 'Fresh'
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={draft.type === option.type && draft.reefer === option.reefer}
                    aria-pressed={draft.type === option.type && draft.reefer === option.reefer}
                    className="ad-role-card"
                    disabled={blocked}
                    onClick={() => pickType(option.type, option.reefer)}
                  >
                    <strong>{option.label}</strong>
                    <span>{blocked ? 'Only for Fresh vehicles.' : option.note}</span>
                  </button>
                )
              })}
            </div>
          </Card>
          <Card label="Details">
            <CardLabel>Step 3 · Details</CardLabel>
            <div className="ad-form-grid">
              <Field label="Depot" hint="The depot this vehicle works from.">
                <select
                  value={draft.depot}
                  onChange={(event) => change({ depot: event.target.value })}
                >
                  {depots.map((depot) => (
                    <option key={depot}>{depot}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Registration"
                error={errors.registration}
                hint="Number plate, optional."
              >
                <input
                  value={draft.registration}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.registration)}
                  onChange={(event) => change({ registration: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field
                label="Weight capacity (kg)"
                error={errors.weight}
                hint="What it can carry by weight."
              >
                <input
                  inputMode="numeric"
                  value={draft.weight}
                  aria-invalid={Boolean(errors.weight)}
                  onChange={(event) => change({ weight: event.target.value })}
                />
              </Field>
              <Field
                label="Volume capacity (m³)"
                error={errors.volume}
                hint="What it can carry by volume."
              >
                <input
                  inputMode="decimal"
                  value={draft.volume}
                  aria-invalid={Boolean(errors.volume)}
                  onChange={(event) => change({ volume: event.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>
        <div className="ad-stack">
          <Card label="Summary">
            <CardLabel>Summary</CardLabel>
            <dl className="ad-rows">
              <div>
                <dt>Vehicle ID</dt>
                <dd>{nextId}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{kind?.label}</dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd>
                  {Number(draft.weight) || '—'} kg · {Number(draft.volume) || '—'} m³
                </dd>
              </div>
            </dl>
            <div className="ad-chips">
              <Pill>{draft.brand}</Pill>
              <Pill>{draft.depot}</Pill>
              {draft.reefer && <Pill>Refrigerated</Pill>}
            </div>
          </Card>
          <div className="ad-actions">
            <Btn onClick={save} disabled={action.isPending}>
              Add vehicle
            </Btn>
            <Btn variant="grey" onClick={() => navigate('/administration/vehicles')}>
              Cancel
            </Btn>
            <p className="ad-note">The vehicle ID is assigned when you add it.</p>
          </div>
        </div>
      </div>
    </AdminPage>
  )
}
