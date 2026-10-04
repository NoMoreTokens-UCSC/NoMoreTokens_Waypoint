import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, Truck, ArrowRight, ChevronRight } from 'lucide-react'
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
  Notice,
  EmptyState,
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

  // Build vehicle → orders mapping for the map
  const vehicleOrders: Record<string, string[]> = {}
  data.orders.forEach((order) => {
    if (order.vehicleId) {
      if (!vehicleOrders[order.vehicleId]) {
        vehicleOrders[order.vehicleId] = []
      }
      vehicleOrders[order.vehicleId].push(order.id)
    }
  })

  const vehicles = data.vehicles.filter(
    (v) =>
      `${v.id} ${v.location} ${v.brand}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'All' || v.status === status),
  )
  const selectedId = selected ?? (tracking ? data.vehicles.find((v) => v.status === "En route")?.id ?? null : null)
  const vehicle = data.vehicles.find((v) => v.id === selectedId)
  const vehicleOrder = data.orders.find((o) => o.vehicleId === vehicle?.id && o.trip === 1)
  const vehicleStop = vehicleOrder
    ? data.stops.find((stop) => stop.orderIds.includes(vehicleOrder.id))
    : undefined
  const isDelayedVehicle = vehicle?.id === 'VEH027'
  const delayedVehicleIds = ['VEH027']
  const expectedArrival = vehicleStop?.eta,
    windowEnd = vehicleOrder?.windowEnd ?? '07:30',
    deliveryDelay = isDelayedVehicle || Boolean(expectedArrival && expectedArrival > windowEnd)
  const usage = (id: string, key: 'volume' | 'weight') =>
    data.orders.filter((o) => o.vehicleId === id && o.trip === 1).reduce((n, o) => n + o[key], 0)
  const current = Math.min(page, Math.max(0, Math.ceil(vehicles.length / 10) - 1))
  const fleetFilters = (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
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
      <div className="w-full sm:w-[240px]">
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
  )
  return (
    <>
      <PageHeading
        eyebrow="Dispatch · fleet operations"
        title={tracking ? 'Live tracking' : 'Fleet'}
        description="Every vehicle. Both capacity limits. One operational view."
        action={
          <div className="fleet-heading-actions">
            <div className="fleet-reporting-summary">
              <span className="fleet-live-dot" />
              {data.vehicles.filter((v) => v.status !== 'Offline').length} reporting live
            </div>
            {tracking ? (
              <div className="flex gap-2">
                <Link to="/dispatcher/fleet">
                  <Button variant="outline">
                    <Truck size={16} />
                    Fleet list
                  </Button>
                </Link>
                <Link to="/dispatcher/orders">
                  <Button>
                    Orders list
                    <ArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/dispatcher/tracking">
                <Button>
                  <MapPin size={16} />
                  Live map
                </Button>
              </Link>
            )}
          </div>
        }
      />
      {tracking ? (
        <div className="metrics four">
          <Metric
            label="Fleet"
            value={data.vehicles.length}
            detail="Total vehicles"
            icon={<Truck size={16} />}
          />
          <Metric
            label="En route"
            value={data.vehicles.filter((v) => v.status === 'En route').length}
            detail="Vehicles currently moving"
            icon={<Truck size={16} />}
          />
          <Metric
            label="Delivery delays"
            value={delayedVehicleIds.length}
            detail="ETA outside delivery window"
          />
          <Metric
            label="Offline"
            value={data.vehicles.filter((v) => v.status === 'Offline').length}
            detail="Last reported location"
            icon={<Truck size={16} />}
          />
        </div>
      ) : (
        <div className="metrics four">
          {['Available', 'Loading', 'En route', 'Offline'].map((s) => (
            <Metric
              key={s}
              label={s}
              value={data.vehicles.filter((v) => v.status === s).length}
              detail={s === 'Offline' ? 'Last reported location' : 'Current status'}
              icon={<Truck size={16} />}
            />
          ))}
        </div>
      )}
      {tracking ? (
        <>
          {fleetFilters}
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
              selectedVehicleId={selectedId}
              vehicleOrders={vehicleOrders}
              offline={data.settings.simulatedOffline}
              onVehicleSelect={(selectedVehicle) => setSelected(selectedVehicle.id)}
              delayedVehicleIds={delayedVehicleIds}
            />
          </Suspense>
          <div className="panel-body flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />
              {data.vehicles.filter((v) => v.status !== 'Offline').length} reporting live
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2" />
              Offline · last location
            </span>
            <span>Click a marker to inspect vehicle details</span>
          </div>
          </Panel>
        </>
      ) : (
        <Panel>
          {fleetFilters}
          <div className="table-scroll fleet-table-scroll">
            <table className="data-table fleet-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type / capability</th>
                  <th>Volume used</th>
                  <th>Weight used</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vehicles.slice(current * 10, current * 10 + 10).map((v) => (
                  <tr key={v.id} className="fleet-row">
                    <td>
                      <div className="fleet-identity">
                        <Truck size={24} strokeWidth={1.8} />
                        <div>
                          <span className="table-link">{v.id}</span>
                          <small>{v.brand}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {v.type}
                      <small>
                        <span className="fleet-capability">{v.reefer ? 'Reefer' : 'Ambient'}</span>
                      </small>
                    </td>
                    <td>
                      <div className="fleet-capacity">
                        <CapacityBar
                          label="Volume"
                          used={usage(v.id, 'volume')}
                          total={v.volumeCapacity}
                          unit="m³"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="fleet-capacity">
                        <CapacityBar
                          label="Weight"
                          used={usage(v.id, 'weight')}
                          total={v.weightCapacity}
                          unit="kg"
                        />
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={delayedVehicleIds.includes(v.id) ? 'danger' : undefined}>
                        {delayedVehicleIds.includes(v.id) ? 'Delayed · +20 min' : v.status}
                      </StatusBadge>
                    </td>
                    <td>
                      <span className="fleet-location">
                        <MapPin size={18} />
                        {v.location}
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      {v.updatedMinutes ? `${v.updatedMinutes}m ago` : 'Just now'}
                    </td>
                    <td>
                      <span className="row-arrow">
                        <ChevronRight className="text-muted-foreground" size={16} />
                      </span>
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
        open={tracking && !!vehicle}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {vehicle && (
          vehicle.status === 'Offline' ? (
            <>
              <div className="text-[10px] uppercase tracking-[1.4px] text-muted-foreground mb-2">
                Last reported position
              </div>
              <h2 className="text-2xl font-semibold mb-4">{vehicle.id}</h2>
              <StatusBadge tone="neutral">
                Offline · {vehicle.updatedMinutes || 6} minutes
              </StatusBadge>
              <div className="grid gap-4 my-5 text-sm">
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">Destination</span>
                  <strong>Last report · {vehicle.location}</strong>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">
                    Expected arrival
                  </span>
                  <strong>Unavailable while offline</strong>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">Last report</span>
                  <strong>{vehicle.updatedMinutes || 6}:00 · Position may be stale</strong>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Keep the last reported pin. Do not animate movement or recalculate arrival until
                connectivity returns.
              </p>
              <Link to="/dispatcher/fleet" onClick={() => setSelected(null)}>
                <Button variant="outline" className="w-full">
                  View offline fleet
                </Button>
              </Link>
            </>
          ) : (
            <>
            <div className="text-[10px] uppercase tracking-[1.4px] text-muted-foreground mb-2">
              Selected vehicle
            </div>
            <h2 className="text-2xl font-semibold mb-4">{vehicle.id}</h2>
            {deliveryDelay && (
              <StatusBadge tone="danger">Forecast delay · after window</StatusBadge>
            )}
            <StatusBadge tone={deliveryDelay ? 'danger' : undefined}>
              {deliveryDelay ? 'Forecast delay · +20 min' : `${vehicle.status} · Trip ${vehicleOrder?.trip ?? 1}`}
            </StatusBadge>
            <div className="grid gap-4 my-5 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Destination</span>
                <strong>
                  {vehicleOrder
                    ? `${vehicleOrder.outlet} · ${vehicleOrder.brand} / ${vehicleOrder.temperature}`
                    : isDelayedVehicle
                      ? 'OUT045 · Tech'
                      : vehicle.location}
                </strong>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Expected arrival</span>
                <strong>
                  {vehicleStop
                    ? `${vehicleStop.eta} · Window ${vehicleOrder?.window}–${windowEnd}`
                    : isDelayedVehicle
                      ? '07:50 · Window ends 07:30'
                    : 'Route timing unavailable'}
                </strong>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">
                  Location freshness
                </span>
                <strong>
                  {vehicle.updatedMinutes ? `${vehicle.updatedMinutes} minutes ago` : '06:06:03 · 3 seconds ago'}
                </strong>
              </div>
            </div>
            {deliveryDelay && (
              <p className="text-sm text-muted-foreground mb-4">
                Expected arrival is outside the delivery window. Review the remaining route and
                contact the outlet if needed.
              </p>
            )}
            <div className="fleet-drawer-capacity">
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
            </div>
            <Link
              to={vehicleOrder ? `/dispatcher/orders?search=${vehicleOrder.id}` : '/dispatcher/orders'}
              onClick={() => setSelected(null)}
            >
              <Button className="w-full mt-4">
                {vehicleOrder?.priority ? 'View priority order' : 'View assigned order'}
                <ArrowRight size={16} />
              </Button>
            </Link>
            </>
          )
        )}
      </Modal>
    </>
  )
}

/** Bar height in px. Empty data gives 0, and any non-zero value keeps a visible minimum. */
function barHeight(value: number, max: number, scale = 180) {
  if (value <= 0 || max <= 0) return 0
  return Math.max(8, (value / max) * scale)
}

type ChartMode = 'status' | 'brand' | 'temperature'

export function AnalyticsPage() {
  const { data } = useOperations()
  const [chartMode, setChartMode] = useState<ChartMode>('status')
  if (!data) return null
  const orders = data.orders
  const delivered = orders.filter((o) => o.status === 'Delivered').length
  const totalVolume = orders.reduce((n, o) => n + o.volume, 0)
  const totalWeight = orders.reduce((n, o) => n + o.weight, 0)
  const allocated = orders.filter((o) => o.vehicleId).length
  const reporting = data.vehicles.filter((v) => v.status !== 'Offline').length

  const volumeByWindow = [...new Set(orders.map((o) => o.window))]
    .sort()
    .map((window) => {
      const inWindow = orders.filter((o) => o.window === window)
      return {
        window,
        total: inWindow.reduce((sum, o) => sum + o.volume, 0),
        chilled: inWindow
          .filter((o) => o.temperature === 'Chilled')
          .reduce((sum, o) => sum + o.volume, 0),
      }
    })
  const peakTotal = volumeByWindow.reduce((peak, item) => (item.total > peak.total ? item : peak), {
    window: '—',
    total: 0,
    chilled: 0,
  })
  const peakChilled = volumeByWindow.reduce(
    (peak, item) => (item.chilled > peak.chilled ? item : peak),
    { window: '—', total: 0, chilled: 0 },
  )

  const brands = [...new Set(orders.map((o) => o.brand))].sort()
  const maxBrandCount = Math.max(0, ...brands.map((b) => orders.filter((o) => o.brand === b).length))

  type Row = (typeof orders)[number]
  type Segment = { key: string; label: string; cls: string; match: (o: Row) => boolean }
  const segmentsByMode: Record<ChartMode, Segment[]> = {
    status: [
      {
        key: 'allocated',
        label: 'Allocated',
        cls: 'seg-allocated',
        match: (o) => o.status !== 'Deferred' && o.status !== 'Delivered' && !!o.vehicleId,
      },
      {
        key: 'unallocated',
        label: 'Not yet allocated',
        cls: 'seg-unallocated',
        match: (o) => o.status !== 'Deferred' && o.status !== 'Delivered' && !o.vehicleId,
      },
      { key: 'deferred', label: 'Deferred', cls: 'seg-deferred', match: (o) => o.status === 'Deferred' },
      { key: 'delivered', label: 'Delivered', cls: 'seg-delivered', match: (o) => o.status === 'Delivered' },
    ],
    brand: brands.map((brand) => ({
      key: brand,
      label: brand,
      cls: `seg-${brand.toLowerCase()}`,
      match: (o: Row) => o.brand === brand,
    })),
    temperature: [
      { key: 'chilled', label: 'Chilled', cls: 'seg-chilled', match: (o) => o.temperature === 'Chilled' },
      { key: 'ambient', label: 'Ambient', cls: 'seg-ambient', match: (o) => o.temperature === 'Ambient' },
    ],
  }
  const segments = segmentsByMode[chartMode]
  const stackedByWindow = volumeByWindow.map((item) => ({
    window: item.window,
    parts: segments.map((segment) => ({
      ...segment,
      value: orders
        .filter((o) => o.window === item.window && segment.match(o))
        .reduce((n, o) => n + o.volume, 0),
    })),
  }))

  return (
    <>
      <PageHeading
        title="Demand outlook"
        description="Plan vehicle capacity around the busiest delivery windows."
      />
      <div className="metrics four">
        <Metric
          label="Peak total volume"
          value={`${peakTotal.total.toFixed(1)} m³`}
          detail={`${peakTotal.window} · all brands`}
        />
        <Metric
          label="Peak chilled volume"
          value={`${peakChilled.chilled.toFixed(1)} m³`}
          detail={`${peakChilled.window} · chilled subset`}
        />
        <Metric label="Peak timing" value={peakTotal.window} detail="Highest ordered volume" />
        <Metric
          label="Total demand weight"
          value={`${totalWeight.toLocaleString()} kg`}
          detail="All confirmed orders"
        />
      </div>
      <div className="split-grid">
        <div className="analytics-column min-w-0">
          <Panel title="Ordered volume by delivery window">
            <div className="panel-body">
              <div className="filter-tabs analytics-toggle" role="group" aria-label="Group volume by">
                {(
                  [
                    ['status', 'Status'],
                    ['brand', 'Brand'],
                    ['temperature', 'Temperature'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    className={`filter-tab ${chartMode === mode ? 'selected' : ''}`}
                    aria-pressed={chartMode === mode}
                    onClick={() => setChartMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="analytics-legend">
                {segments.map((segment) => (
                  <span key={segment.key}>
                    <i className={`analytics-swatch ${segment.cls}`} /> {segment.label}
                  </span>
                ))}
                <span>All values in m³</span>
              </div>
              {volumeByWindow.length === 0 ? (
                <EmptyState title="No orders yet" description="Volume appears once orders are confirmed." />
              ) : (
                <div className="window-stack-chart">
                  {stackedByWindow.map((item) => (
                    <div className="window-volume-group" key={item.window}>
                      <div className="window-stack">
                        {item.parts.map((part) => (
                          <span
                            key={part.key}
                            className={`window-stack-part ${part.cls}`}
                            title={`${part.label}: ${part.value.toFixed(1)} m³`}
                            data-value={part.value.toFixed(1)}
                            style={{ height: `${barHeight(part.value, peakTotal.total)}px` }}
                          />
                        ))}
                      </div>
                      <small>{item.window}</small>
                    </div>
                  ))}
                </div>
              )}
              <Notice title="Plan capacity before the peak" tone="neutral">
                Include every requested order, including deferred demand. Reserve compatible vehicles
                and refrigeration; volume alone does not determine vehicle count.
              </Notice>
            </div>
          </Panel>
          <Panel title="Totals" description="Orders, volume and weight across all outlets.">
            <div className="panel-body analytics-run-summary">
              <div>
                <span>Orders delivered</span>
                <strong>{delivered} / {orders.length}</strong>
                <small>Orders with status Delivered</small>
              </div>
              <div>
                <span>Demand volume</span>
                <strong>{totalVolume.toFixed(1)} m³</strong>
                <small>Confirmed demand across all outlets</small>
              </div>
              <div>
                <span>Demand weight</span>
                <strong>{totalWeight.toLocaleString()} kg</strong>
                <small>Both limits apply to every trip</small>
              </div>
            </div>
          </Panel>
        </div>
        <div className="analytics-column min-w-0">
          <Panel title="Demand by brand" description="Number of orders in this workspace.">
            <div className="panel-body pb-12">
              {brands.length === 0 ? (
                <EmptyState title="No orders yet" description="Brand demand appears once orders exist." />
              ) : (
                <div className="brand-bars">
                  {brands.map((brand) => {
                    const count = orders.filter((o) => o.brand === brand).length
                    const width = maxBrandCount > 0 ? (count / maxBrandCount) * 100 : 0
                    return (
                      <div key={brand} className="brand-bar-row">
                        <span className="brand-bar-label">{brand}</span>
                        <div className="brand-bar-track">
                          <div
                            className={`brand-bar-fill brand-${brand.toLowerCase()}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <strong className="brand-bar-count">{count}</strong>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Plan health">
            <div className="panel-body">
              <CapacityBar label="Allocated orders" used={allocated} total={orders.length} />
              <CapacityBar label="Delivered orders" used={delivered} total={orders.length} />
              <CapacityBar label="Reporting vehicles" used={reporting} total={data.vehicles.length} />
              <p className="text-xs text-muted-foreground mt-6">
                Figures cover the orders and vehicles in this workspace.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
