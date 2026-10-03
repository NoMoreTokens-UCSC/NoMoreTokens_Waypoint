import { Search } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { vehicleDepot, vehicleKind } from '../../../../domain/fleet'
import type { Vehicle } from '../../../../domain/models'
import type { Brand } from '../../../../domain/outlets'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, LinkBtn, Pill } from '../components/AdminKit'
import { brands } from '../lib/outlets'
import { useMembers } from '../lib/team'
import { capacityText, driverOf, useVehicles, vehicleStatusTone } from '../lib/vehicles'

const depots = ['Peliyagoda', 'Kandy']
type Kind = 'truck' | 'van' | 'reefer'
const kinds: { value: Kind; label: string }[] = [
  { value: 'truck', label: 'Trucks' },
  { value: 'van', label: 'Vans' },
  { value: 'reefer', label: 'Refrigerated' },
]
const kindMatches = (vehicle: Vehicle, kind: Kind) =>
  kind === 'reefer' ? vehicle.reefer : vehicle.type === (kind === 'truck' ? 'Truck' : 'Van')

/** A filter chip that opens a short list. */
function Choice<T extends string>({
  dot,
  label,
  value,
  options,
  onChange,
}: {
  dot: string
  label: string
  value: T | 'all'
  options: { value: T; label: string }[]
  onChange: (value: T | 'all') => void
}) {
  const current = options.find((option) => option.value === value)?.label ?? label
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="ad-chip" aria-label={`Filter by ${label.split(' ')[1]}`}>
        <i className={`ad-dot ad-dot-${dot}`} aria-hidden="true" />
        {current}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ad-menu" align="start" sideOffset={6}>
          {[{ value: 'all' as const, label }, ...options].map((option) => (
            <DropdownMenu.Item
              key={option.value}
              data-checked={option.value === value}
              onSelect={() => onChange(option.value)}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Vehicles: the fleet, what each can carry, where it is based and who drives it. */
export default function VehiclesPage() {
  const { vehicles, loaded } = useVehicles()
  const { members } = useMembers()
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState<Brand | 'all'>('all')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [depot, setDepot] = useState<string>('all')
  useBreadcrumb([{ label: 'Vehicles' }])
  if (!loaded) return null
  const text = search.trim().toLowerCase()
  const shown = [...vehicles]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter(
      (vehicle) =>
        (!text || `${vehicle.id} ${vehicle.registration ?? ''}`.toLowerCase().includes(text)) &&
        (brand === 'all' || vehicle.brand === brand) &&
        (kind === 'all' || kindMatches(vehicle, kind)) &&
        (depot === 'all' || vehicleDepot(vehicle) === depot),
    )
  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Vehicles"
        title="Vehicles"
        lead="The fleet the dispatcher plans with. Add a vehicle here, then assign a driver to it."
        aside={<LinkBtn to="/administration/vehicles/new">Add vehicle</LinkBtn>}
      />
      <div className="ad-toolbar">
        <label className="ad-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search vehicle or registration"
            placeholder="Search vehicle or registration"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Choice
          dot="orange"
          label="All brands"
          value={brand}
          options={brands.map((entry) => ({ value: entry.brand, label: entry.brand }))}
          onChange={setBrand}
        />
        <Choice dot="amber" label="All types" value={kind} options={kinds} onChange={setKind} />
        <Choice
          dot="green"
          label="All depots"
          value={depot}
          options={depots.map((name) => ({ value: name, label: name }))}
          onChange={setDepot}
        />
      </div>

      <div className="ad-table-card">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Brand</th>
              <th>Type</th>
              <th>Depot</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((vehicle) => {
              const driver = driverOf(vehicle, members)
              return (
                <tr key={vehicle.id}>
                  <td>
                    <Link className="ad-strong" to={`/administration/vehicles/${vehicle.id}`}>
                      {vehicle.id}
                    </Link>
                    {vehicle.registration && (
                      <small className="ad-sub">{vehicle.registration}</small>
                    )}
                  </td>
                  <td>
                    <Pill>{vehicle.brand}</Pill>
                  </td>
                  <td>{vehicleKind(vehicle)}</td>
                  <td>{vehicleDepot(vehicle)}</td>
                  <td>{capacityText(vehicle)}</td>
                  <td>
                    <Pill tone={vehicleStatusTone(vehicle.status)}>{vehicle.status}</Pill>
                  </td>
                  <td>
                    {driver ? (
                      <Link to={`/administration/team/${driver.id}`}>{driver.name}</Link>
                    ) : (
                      <span className="ad-muted">Not assigned</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ad-empty">No vehicle matches these filters.</p>}
        <div className="ad-table-foot">
          <span>
            Showing {shown.length} of {vehicles.length} vehicles
          </span>
          <span>Sorted by vehicle ID</span>
        </div>
      </div>
      <ul className="ad-cards" aria-label="Vehicles">
        {shown.map((vehicle) => (
          <li key={vehicle.id}>
            <Link to={`/administration/vehicles/${vehicle.id}`} className="ad-person">
              <div>
                <strong>
                  {vehicle.id} · {vehicleKind(vehicle)}
                </strong>
                <small>
                  {vehicle.brand} · {vehicleDepot(vehicle)} ·{' '}
                  {driverOf(vehicle, members)?.name ?? 'No driver'}
                </small>
              </div>
              <Pill tone={vehicleStatusTone(vehicle.status)}>{vehicle.status}</Pill>
            </Link>
          </li>
        ))}
      </ul>
    </AdminPage>
  )
}
