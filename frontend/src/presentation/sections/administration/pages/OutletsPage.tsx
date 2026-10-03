import { Search } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Brand } from '../../../../domain/outlets'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, LinkBtn, Pill } from '../components/AdminKit'
import { brands, managerOf, parkingLabel, useOutlets, windowLabel } from '../lib/outlets'
import { useMembers } from '../lib/team'

const depots = ['Peliyagoda', 'Kandy']

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

/** Outlets: every store in the system, its brand, delivery hours and who manages it. */
export default function OutletsPage() {
  const { outlets, loaded } = useOutlets()
  const { members } = useMembers()
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState<Brand | 'all'>('all')
  const [depot, setDepot] = useState<string>('all')
  useBreadcrumb([{ label: 'Outlets' }])
  if (!loaded) return null
  const text = search.trim().toLowerCase()
  const shown = outlets.filter(
    (outlet) =>
      (!text || `${outlet.id} ${outlet.name} ${outlet.district}`.toLowerCase().includes(text)) &&
      (brand === 'all' || outlet.brand === brand) &&
      (depot === 'all' || outlet.depot === depot),
  )
  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Outlets"
        title="Outlets"
        lead="The stores deliveries go to. Add an outlet here, then assign a store manager to it."
        aside={<LinkBtn to="/administration/outlets/new">Add outlet</LinkBtn>}
      />
      <div className="ad-toolbar">
        <label className="ad-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search outlet, name or district"
            placeholder="Search outlet, name or district"
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
              <th>Outlet</th>
              <th>Brand</th>
              <th>District</th>
              <th>Depot</th>
              <th>Delivery window</th>
              <th>Access</th>
              <th>Store manager</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((outlet) => {
              const manager = managerOf(outlet, members)
              return (
                <tr key={outlet.id}>
                  <td>
                    <Link className="ad-strong" to={`/administration/outlets/${outlet.id}`}>
                      {outlet.id}
                    </Link>
                    <small className="ad-sub">{outlet.name}</small>
                  </td>
                  <td>
                    <Pill>{outlet.brand}</Pill>
                  </td>
                  <td>{outlet.district || '—'}</td>
                  <td>{outlet.depot}</td>
                  <td>{windowLabel(outlet)}</td>
                  <td>{parkingLabel(outlet)}</td>
                  <td>
                    {manager ? (
                      <Link to={`/administration/team/${manager.id}`}>{manager.name}</Link>
                    ) : (
                      <Pill tone="amber">No manager</Pill>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ad-empty">No outlet matches these filters.</p>}
        <div className="ad-table-foot">
          <span>
            Showing {shown.length} of {outlets.length} outlets
          </span>
          <span>Sorted by outlet ID</span>
        </div>
      </div>
      <ul className="ad-cards" aria-label="Outlets">
        {shown.map((outlet) => {
          const manager = managerOf(outlet, members)
          return (
            <li key={outlet.id}>
              <Link to={`/administration/outlets/${outlet.id}`} className="ad-person">
                <div>
                  <strong>
                    {outlet.id} · {outlet.name}
                  </strong>
                  <small>
                    {outlet.brand} · {outlet.depot} · {manager ? manager.name : 'No manager yet'}
                  </small>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </AdminPage>
  )
}
