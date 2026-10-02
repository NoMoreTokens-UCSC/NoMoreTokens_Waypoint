import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, Truck, ArrowRight } from 'lucide-react'
import { useOperations } from '../../../hooks/useOperations'
import { Button } from '../../../shared/atoms/button'
import {
  PageHeading,
  Metric,
  Panel,
  SearchField,
  StatusBadge,
  Modal,
  CapacityBar,
} from '../../../shared/molecules/Common'
const OperationsMap = lazy(() => import('../../../shared/organisms/OperationsMap'))

export function FleetPage({ tracking = false }: { tracking?: boolean }) {
  const { data } = useOperations(),
    [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? ''),
    [status, setStatus] = useState('All'),
    [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState(0)
  if (!data) return null
  const vehicles = data.vehicles.filter(
    (v) =>
      `${v.id} ${v.location} ${v.brand}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'All' || v.status === status),
  )
  const vehicle = data.vehicles.find((v) => v.id === selected)
  const usage = (id: string, key: 'volume' | 'weight') =>
    data.orders.filter((o) => o.vehicleId === id && o.trip === 1).reduce((n, o) => n + o[key], 0)
  const current = Math.min(page, Math.max(0, Math.ceil(vehicles.length / 10) - 1))
  return (
    <>
      <PageHeading
        eyebrow="Dispatch · fleet operations"
        title={tracking ? 'Live tracking' : 'Fleet'}
        description="Every vehicle. Both capacity limits. One operational view."
        action={
          <Link to={tracking ? '/dispatcher/fleet' : '/dispatcher/tracking'}>
            <Button variant="outline">
              <MapPin size={16} />
              {tracking ? 'Fleet list' : 'Live map'}
            </Button>
          </Link>
        }
      />
      <div className="metrics four">
        {['Available', 'Loading', 'En route', 'Offline'].map((s) => (
          <Metric
            key={s}
            label={s}
            value={data.vehicles.filter((v) => v.status === s).length}
            detail={s === 'Offline' ? 'Last reported location' : 'Demo vehicle status'}
            icon={<Truck size={16} />}
          />
        ))}
      </div>
      <div className="toolbar">
        <div className="filter-tabs">
          {['All', 'Available', 'Loading', 'En route', 'Offline'].map((s) => (
            <button
              key={s}
              className={`filter-tab ${status === s ? 'selected' : ''}`}
              onClick={() => {
                setStatus(s)
                setPage(0)
              }}
            >
              {s}{' '}
              <span className="ml-1 text-[10px] opacity-60">
                {s === 'All'
                  ? data.vehicles.length
                  : data.vehicles.filter((v) => v.status === s).length}
              </span>
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(0)
            }}
            placeholder="Vehicle or location"
          />
        </div>
      </div>
      {tracking ? (
        <Panel>
          <Suspense
            fallback={
              <div className="h-[420px] grid place-items-center text-muted-foreground">
                Opening saved map…
              </div>
            }
          >
            <OperationsMap
              vehicles={vehicles}
              stops={data.stops}
              offline={data.settings.simulatedOffline}
            />
          </Suspense>
          <div className="panel-body flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />
              Reporting vehicles
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2" />
              Offline · last location
            </span>
            <span>Click a marker to inspect vehicle details</span>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type / capability</th>
                  <th>Volume used</th>
                  <th>Weight used</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.slice(current * 10, current * 10 + 10).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button className="table-link" onClick={() => setSelected(v.id)}>
                        {v.id}
                      </button>
                      <small>{v.brand}</small>
                    </td>
                    <td>
                      {v.type}
                      <small>{v.reefer ? 'Reefer' : 'Ambient'}</small>
                    </td>
                    <td>
                      <div className="min-w-24">
                        <CapacityBar
                          label="Volume"
                          used={usage(v.id, 'volume')}
                          total={v.volumeCapacity}
                          unit="m³"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="min-w-24">
                        <CapacityBar
                          label="Weight"
                          used={usage(v.id, 'weight')}
                          total={v.weightCapacity}
                          unit="kg"
                        />
                      </div>
                    </td>
                    <td>
                      <StatusBadge>{v.status}</StatusBadge>
                    </td>
                    <td>{v.location}</td>
                    <td className="text-muted-foreground">
                      {v.updatedMinutes ? `${v.updatedMinutes}m ago` : 'Just now'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!vehicles.length && (
              <div className="empty-state">No vehicles match these filters.</div>
            )}
          </div>
          <footer className="table-footer">
            <span>
              {vehicles.length} of {data.vehicles.length} vehicles · {status}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={(current + 1) * 10 >= vehicles.length}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </footer>
        </Panel>
      )}
      <Modal
        side
        title={vehicle?.id ?? 'Vehicle details'}
        description={
          vehicle
            ? `${vehicle.brand} · ${vehicle.reefer ? 'Refrigerated' : 'Ambient'} ${vehicle.type.toLowerCase()}`
            : undefined
        }
        open={!!vehicle}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {vehicle && (
          <>
            <StatusBadge>{vehicle.status}</StatusBadge>
            <p className="text-sm mt-2">Last location · {vehicle.location}</p>
            <CapacityBar
              label="Volume"
              used={usage(vehicle.id, 'volume')}
              total={vehicle.volumeCapacity}
              unit="m³"
            />
            <CapacityBar
              label="Weight"
              used={usage(vehicle.id, 'weight')}
              total={vehicle.weightCapacity}
              unit="kg"
            />
            <p className="text-xs text-muted-foreground">
              Trip 1 assignments ·{' '}
              {vehicle.status === 'Offline'
                ? 'Connectivity stale; inspect before relying on this position.'
                : 'Demo data; not live telemetry.'}
            </p>
            <Link to="/dispatcher/tracking" onClick={() => setSelected(null)}>
              <Button variant="outline" className="w-full mt-4">
                View map
                <ArrowRight size={16} />
              </Button>
            </Link>
          </>
        )}
      </Modal>
    </>
  )
}

export function AnalyticsPage() {
  const { data } = useOperations()
  if (!data) return null
  const delivered = data.orders.filter((o) => o.status === 'Delivered').length
  return (
    <>
      <PageHeading
        title="Capacity outlook"
        description="Operational totals calculated from the current demo workspace."
      />
      <div className="metrics">
        <Metric
          label="Orders served"
          value={`${delivered} / ${data.orders.length}`}
          detail="Accepted delivery proof only"
        />
        <Metric
          label="Demand volume"
          value={`${data.orders.reduce((n, o) => n + o.volume, 0).toFixed(1)} m³`}
          detail="Confirmed demand across all outlets"
        />
        <Metric
          label="Demand weight"
          value={`${data.orders.reduce((n, o) => n + o.weight, 0).toLocaleString()} kg`}
          detail="Both limits apply to every trip"
        />
      </div>
      <div className="split-grid">
        <Panel title="Demand by brand" description="Number of orders in this workspace">
          <div className="panel-body pb-12">
            <div className="chart-bars">
              {(['Fresh', 'Style', 'Tech'] as const).map((brand) => {
                const count = data.orders.filter((o) => o.brand === brand).length
                return (
                  <div
                    key={brand}
                    className="chart-bar"
                    style={{
                      height: `${Math.max(10, (count / data.orders.length) * 180)}px`,
                      background:
                        brand === 'Fresh' ? '#f26a2e' : brand === 'Style' ? '#8a69ac' : '#5185a2',
                    }}
                  >
                    <small>{count}</small>
                    <span>{brand}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
        <Panel title="Plan health">
          <div className="panel-body">
            <CapacityBar
              label="Allocated orders"
              used={data.orders.filter((o) => o.vehicleId).length}
              total={data.orders.length}
            />
            <CapacityBar
              label="Accepted delivery proof"
              used={delivered}
              total={data.orders.length}
            />
            <CapacityBar
              label="Reporting vehicles"
              used={data.vehicles.filter((v) => v.status !== 'Offline').length}
              total={data.vehicles.length}
            />
            <p className="text-xs text-muted-foreground mt-6">
              This is a single demo run. Historical forecasting and live telemetry require backend
              integration.
            </p>
          </div>
        </Panel>
      </div>
    </>
  )
}
