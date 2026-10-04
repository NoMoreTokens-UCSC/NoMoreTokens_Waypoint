import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, ChevronDown, WandSparkles, Truck, ShieldCheck } from 'lucide-react'
import { useOperations, useAction, useEvidence } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { Button } from '../../../shared/atoms/button'
import { formatLongDate, formatShortDate, formatWeekday } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  PageHeading,
  Panel,
  Notice,
  StatusBadge,
  CapacityBar,
  EmptyState,
  Field,
} from '../../../shared/molecules/Common'
import { PlanningSteps } from '../organisms/PlanningSteps'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { allocationErrors, publicationErrors, departureErrors } from '../../../../domain/rules'
import { toast } from 'sonner'

type ConstraintType = 'VOLUME_CAPACITY' | 'WEIGHT_CAPACITY' | 'TEMPERATURE_MISMATCH' | 'MAX_TRIPS'
type ConstraintError = { type: ConstraintType; orderId: string; vehicleId: string; trip: number }

export function AllocationPage() {
  const { data } = useOperations(),
    apis = useApis(),
    clock = useBusinessClock(),
    action = useAction()
  const [vehicleIdx, setVehicleIdx] = useState(0)
  const [constraintError, setConstraintError] = useState<ConstraintError | null>(null)
  useBreadcrumb(null)

  if (!data) return null

  const unallocated = data.orders.filter((o) => !o.vehicleId && o.status !== 'Deferred')
  const allocated = data.orders.filter((o) => o.vehicleId)
  const deferred = data.orders.filter((o) => o.status === 'Deferred')
  const priorityViolation = unallocated.find((o) => o.priority)

  const vehicle = data.vehicles[vehicleIdx] ?? data.vehicles[0]
  if (!vehicle) return null

  const tripOrders = (t: number) =>
    data.orders.filter((o) => o.vehicleId === vehicle.id && o.trip === t)
  const t1 = tripOrders(1),
    t2 = tripOrders(2)
  const volCap = vehicle.volumeCapacity
  const WEIGHT_CAP = vehicle.weightCapacity

  const sum = (orders: typeof data.orders, key: 'weight' | 'volume') =>
    orders.reduce((n, o) => n + o[key], 0)

  const tryAssign = (orderId: string, tripNum: number) => {
    const ord = data.orders.find((o) => o.id === orderId)!
    // Same rules as publishing (brand, window, temperature, trips, weight, volume), checked before sending.
    const shared = allocationErrors(ord, vehicle, tripNum, data.orders)
    if (shared.length) {
      toast.error(shared[0])
      return
    }
    const existing = tripOrders(tripNum)
    const usedTrips = new Set(data.orders.filter((o) => o.vehicleId === vehicle.id).map((o) => o.trip))

    if (ord.temperature === 'Chilled' && !vehicle.reefer) {
      setConstraintError({ type: 'TEMPERATURE_MISMATCH', orderId, vehicleId: vehicle.id, trip: tripNum })
      return
    }
    if (!usedTrips.has(tripNum) && usedTrips.size >= 2) {
      setConstraintError({ type: 'MAX_TRIPS', orderId, vehicleId: vehicle.id, trip: tripNum })
      return
    }
    if (sum(existing, 'weight') + ord.weight > WEIGHT_CAP) {
      setConstraintError({ type: 'WEIGHT_CAPACITY', orderId, vehicleId: vehicle.id, trip: tripNum })
      return
    }
    if (sum(existing, 'volume') + ord.volume > volCap) {
      setConstraintError({ type: 'VOLUME_CAPACITY', orderId, vehicleId: vehicle.id, trip: tripNum })
      return
    }
    action.run(() => apis.planning.allocate(orderId, vehicle.id, tripNum), 'Order allocated')
  }

  // Constraint review screen
  if (constraintError) {
    const ord = data.orders.find((o) => o.id === constraintError.orderId)!
    const veh = data.vehicles.find((v) => v.id === constraintError.vehicleId)!
    const existing = data.orders.filter(
      (o) => o.vehicleId === constraintError.vehicleId && o.trip === constraintError.trip,
    )
    const curW = sum(existing, 'weight'),
      curV = sum(existing, 'volume')
    const vc = veh.volumeCapacity

    const titles: Record<ConstraintType, string> = {
      VOLUME_CAPACITY: 'Insufficient volume capacity',
      WEIGHT_CAPACITY: 'Insufficient weight capacity',
      TEMPERATURE_MISMATCH: 'Chilled demand requires a reefer',
      MAX_TRIPS: 'Maximum two trips per vehicle',
    }
    const messages: Record<ConstraintType, string> = {
      VOLUME_CAPACITY: `The order requires ${ord.volume} m³. This van has ${(vc - curV).toFixed(1)} m³ remaining. No order was assigned.`,
      WEIGHT_CAPACITY: `The proposed total exceeds the ${WEIGHT_CAP} kg payload by ${curW + ord.weight - WEIGHT_CAP} kg. No order was assigned.`,
      TEMPERATURE_MISMATCH: `${veh.id} cannot carry chilled goods. Choose a refrigerated vehicle.`,
      MAX_TRIPS: `A third trip cannot be created. Use another compatible vehicle or record a valid deferral.`,
    }

    return (
      <>
        <PageHeading
          title={titles[constraintError.type]}
          description="Assignment rejected · The draft plan is unchanged"
        />
        <PlanningSteps current={1} />
        <Notice tone="warning" title={constraintError.type}>
          {messages[constraintError.type]}
        </Notice>
        <div className="split-grid mt-5">
          <Panel
            title="Current trip"
            description={
              constraintError.type === 'MAX_TRIPS'
                ? 'Trip 1 + Trip 2 are the only valid slots'
                : `${veh.id} · ${veh.reefer ? 'Reefer van' : 'Ambient van'} · Trip ${constraintError.trip}`
            }
          >
            <div className="panel-body">
              <CapacityBar label="Weight" used={curW} total={WEIGHT_CAP} unit="kg" />
              <CapacityBar label="Volume" used={curV} total={vc} unit="m³" />
            </div>
          </Panel>
          <Panel
            title="Proposed assignment"
            description={
              constraintError.type === 'MAX_TRIPS'
                ? 'Vehicle trip limit'
                : `${ord.id} · ${ord.weight} kg · ${ord.volume} m³${ord.temperature === 'Chilled' ? ' · Chilled' : ''}`
            }
          >
            <div className="panel-body">
              {constraintError.type === 'MAX_TRIPS' ? (
                <>
                  <CapacityBar label="Weight" used={0} total={WEIGHT_CAP} unit="kg" />
                  <CapacityBar label="Volume" used={0} total={vc} unit="m³" />
                  <div className="check-row" style={{ paddingTop: 12 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    <span style={{ fontSize: 13 }}>Trip 3 blocked</span>
                  </div>
                </>
              ) : constraintError.type === 'TEMPERATURE_MISMATCH' ? (
                <>
                  <CapacityBar label="Weight" used={ord.weight} total={WEIGHT_CAP} unit="kg" />
                  <CapacityBar label="Volume" used={ord.volume} total={vc} unit="m³" />
                  <div className="check-row" style={{ paddingTop: 12 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    <span style={{ fontSize: 13 }}>Ambient + Chilled</span>
                  </div>
                </>
              ) : (
                <>
                  <CapacityBar label="Weight" used={curW + ord.weight} total={WEIGHT_CAP} unit="kg" />
                  <CapacityBar label="Volume" used={curV + ord.volume} total={vc} unit="m³" />
                </>
              )}
            </div>
          </Panel>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => setConstraintError(null)}>Return to allocation</Button>
          <Link to="/dispatcher/deferrals">
            <Button variant="outline">Review deferrals</Button>
          </Link>
        </div>
      </>
    )
  }

  const allDone = unallocated.length === 0
  const revNum = (data.settings.routeRevision ?? 3).toString().padStart(2, '0')

  return (
    <>
      <PageHeading
        title="Planning & allocation"
        description={`${formatLongDate(clock.deliveryDate)} · Locked demand · Revision ${revNum} draft`}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={action.isPending || data.settings.published}
            onClick={() =>
              action.run(
                () => apis.planning.autoAllocate(),
                'Allocation proposed. Review the checks before publishing.',
              )
            }
          >
            <WandSparkles size={14} />
            Propose allocations
          </Button>
        }
      />
      <PlanningSteps current={1} />

      {priorityViolation && (
        <Notice tone="danger" title="1 priority outlet needs allocation">
          {priorityViolation.outlet} was unserved on the previous run. Publishing is blocked until
          this order has a valid trip.
        </Notice>
      )}
      {allDone && !priorityViolation && (
        <Notice tone="success" title="All confirmed orders allocated">
          {data.orders.length} orders have compatible trips. Weight, volume, temperature and the
          two-trip limit are satisfied.
        </Notice>
      )}

      <div className="alloc-layout">
        {/* Left: Unallocated queue */}
        <div className="panel alloc-queue">
          <div className="panel-heading">
            <div>
              <strong>Unallocated · {unallocated.length}</strong>
            </div>
          </div>
          <div className="panel-body">
            {allDone ? (
              <div className="alloc-success-state">
                <p className="text-success font-semibold" style={{ color: 'var(--color-success)' }}>
                  All {data.orders.length} orders assigned
                </p>
                <p style={{ fontSize: 13, color: '#6e737b', marginTop: 6, lineHeight: 1.5 }}>
                  No demand remains in this queue. Vehicle panels show the selected trip; review
                  validates the complete fleet allocation.
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#6e737b', marginBottom: 12 }}>
                  Assign an order to the selected vehicle. Capacity and compatibility are
                  checked before it is assigned.
                </p>
                {unallocated.map((o) => (
                  <div key={o.id} className="alloc-order-card">
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>
                        {o.id} · {o.outlet}
                      </p>
                      <p style={{ fontSize: 12, color: '#6e737b', marginTop: 2 }}>
                        {o.weight} kg · {o.volume} m³ · {o.temperature}
                      </p>
                      {o.priority && (
                        <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 2, fontWeight: 500 }}>
                          Must serve · Previously skipped
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={o.priority && t1.length === 0 ? 'default' : 'outline'}
                      disabled={action.isPending || data.settings.published}
                      onClick={() => tryAssign(o.id, t1.length === 0 ? 1 : 2)}
                    >
                      Assign to Trip {t1.length === 0 ? 1 : 2}
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right: Vehicle panel */}
        <div>
          <div className="vehicle-area-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 15 }}>{vehicle.id}</strong>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#22b563',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, color: '#6e737b' }}>
                {vehicle.reefer ? 'Reefer' : 'Ambient'} · Available
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVehicleIdx((vehicleIdx + 1) % data.vehicles.length)}
            >
              Try {vehicle.reefer ? 'ambient' : 'reefer'} vehicle
            </Button>
          </div>

          <div className="trips-row">
            {/* Trip 1 */}
            <div className="trip-card">
              <div className="trip-card-header">
                <span style={{ fontWeight: 600, fontSize: 14 }}>Trip 1</span>
                {t1.length > 0 && (
                  <>
                    <span
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#22b563', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: '#6e737b' }}>{t1.length} order</span>
                  </>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#6e737b', marginBottom: 12 }}>
                {vehicle.id} · {vehicle.reefer ? 'Reefer van' : 'Ambient van'}
              </p>
              <CapacityBar label="Weight" used={sum(t1, 'weight')} total={WEIGHT_CAP} unit="kg" />
              <CapacityBar label="Volume" used={sum(t1, 'volume')} total={volCap} unit="m³" />
              {t1.length > 0 ? (
                t1.map((o) => (
                  <div key={o.id} className="trip-order-row">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>
                        {o.id} · {o.outlet}
                      </p>
                      <p style={{ fontSize: 12, color: '#6e737b', marginTop: 2 }}>
                        Window {o.window}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={action.isPending || data.settings.published}
                      onClick={() =>
                        action.run(() => apis.planning.unallocate(o.id), `${o.id} returned to the queue`)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <div className="trip-drop-zone">
                  <p style={{ fontSize: 13, color: '#6e737b' }}>Drop a confirmed order here</p>
                  <p style={{ fontSize: 12, color: '#9ca0a8', marginTop: 4 }}>
                    Temperature, capacity and trip limits checked
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    style={{ marginTop: 12 }}
                    disabled
                  >
                    Assign order
                  </Button>
                </div>
              )}
            </div>

            {/* Trip 2 */}
            <div className="trip-card">
              <div className="trip-card-header">
                <span style={{ fontWeight: 600, fontSize: 14 }}>Trip 2</span>
                {t2.length > 0 ? (
                  <>
                    <span
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#22b563', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: '#6e737b' }}>{t2.length} order</span>
                  </>
                ) : (
                  <>
                    <span
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca0a8', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: '#6e737b' }}>Available</span>
                  </>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#6e737b', marginBottom: 12 }}>
                {vehicle.id} · {vehicle.reefer ? 'Reefer van' : 'Ambient van'}
              </p>
              <CapacityBar label="Weight" used={sum(t2, 'weight')} total={WEIGHT_CAP} unit="kg" />
              <CapacityBar label="Volume" used={sum(t2, 'volume')} total={volCap} unit="m³" />
              {t2.length > 0 ? (
                t2.map((o) => (
                  <div key={o.id} className="trip-order-row">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>
                        {o.id} · {o.outlet}
                      </p>
                      <p style={{ fontSize: 12, color: '#6e737b', marginTop: 2 }}>
                        Window {o.window}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={action.isPending || data.settings.published}
                      onClick={() =>
                        action.run(() => apis.planning.unallocate(o.id), `${o.id} returned to the queue`)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : t1.length > 0 ? (
                <div className="trip-drop-zone">
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Reserved second trip</p>
                  <p style={{ fontSize: 12, color: '#9ca0a8', marginTop: 4 }}>
                    Starts after Trip 1 returns to the depot.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    style={{ marginTop: 12 }}
                    disabled
                  >
                    No compatible demand
                  </Button>
                </div>
              ) : (
                <div className="trip-drop-zone">
                  <p style={{ fontSize: 13, color: '#9ca0a8' }}>Plan Trip 1 first</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    style={{ marginTop: 12 }}
                    disabled
                  >
                    Plan Trip 1 first
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="alloc-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#22b563', flexShrink: 0 }}
            />
            {allocated.length} allocated · {deferred.length} deferred
          </span>
        </div>
        <div>
          {unallocated.length > 0 ? (
            <Link to="/dispatcher/deferrals">
              <Button>Resolve deferrals</Button>
            </Link>
          ) : (
            <Link to="/dispatcher/review">
              <Button>Review allocation</Button>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

const DEFERRAL_REASONS = [
  'Insufficient Volume Capacity',
  'Insufficient Weight Capacity',
  'No Compatible Temperature Capacity',
  'Two-Trip Limit Reached',
]

export function DeferralsPage() {
  const { data } = useOperations(),
    apis = useApis(),
    clock = useBusinessClock(),
    action = useAction()
  const [selectingFor, setSelectingFor] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  useBreadcrumb(null)

  if (!data) return null

  const deferred = data.orders.filter((o) => o.status === 'Deferred')
  const priorityViolations = deferred.filter((o) => o.priority)
  const recordedCount = deferred.filter((o) => o.deferralReason).length
  const allRecorded = recordedCount === deferred.length && deferred.length > 0

  // Select reason sub-view
  if (selectingFor) {
    const ord = data.orders.find((o) => o.id === selectingFor)
    if (!ord) {
      setSelectingFor(null)
      return null
    }
    // Only vehicles that can carry the order's temperature count.
    const carriers = data.vehicles.filter((v) => ord.temperature !== 'Chilled' || v.reefer)
    const maxWeight = Math.max(0, ...carriers.map((v) => v.weightCapacity))
    const maxVolume = Math.max(0, ...carriers.map((v) => v.volumeCapacity))
    const tooBig = ord.weight > maxWeight || ord.volume > maxVolume
    const suggestedReason = !carriers.length
      ? 'No Compatible Temperature Capacity'
      : ord.volume > maxVolume
        ? 'Insufficient Volume Capacity'
        : 'Insufficient Weight Capacity'

    return (
      <>
        <PageHeading
          title="Select deferral reason"
          description={`${ord.id} · ${ord.outlet} · ${ord.brand} / ${ord.temperature}`}
        />
        <PlanningSteps current={2} />
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <strong>Why can this order not be allocated?</strong>
          </div>
          <div className="panel-body">
            <Notice tone="warning" title="Capacity check">
              {!carriers.length
                ? `No vehicle in the fleet can carry ${ord.temperature.toLowerCase()} goods.`
                : tooBig
                  ? `The order needs ${ord.weight} kg and ${ord.volume} m³. The largest compatible vehicle carries ${maxWeight} kg and ${maxVolume} m³, even when empty.`
                  : `The order needs ${ord.weight} kg and ${ord.volume} m³. Compatible vehicles can carry it, but none has room left in both trips. Review the plan before confirming.`}
            </Notice>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {DEFERRAL_REASONS.map((r) => {
                const isSelected = selectedReason === r || (!selectedReason && r === suggestedReason)
                return (
                  <button
                    key={r}
                    className="reason-btn"
                    style={{
                      background: isSelected ? 'var(--color-primary)' : 'var(--color-muted, #f5f4f2)',
                      color: isSelected ? '#fff' : 'inherit',
                      border: 'none',
                      borderRadius: 8,
                      padding: '14px 16px',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onClick={() => setSelectedReason(r)}
                  >
                    {r}
                    {isSelected ? ' · Matches reviewed evidence' : ''}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: '#6e737b', marginTop: 16, lineHeight: 1.5 }}>
              Reason selection records the reviewed daily-capacity decision. Vehicle checks alone do
              not establish that the whole fleet is full.
            </p>
            <Button
              className="w-full"
              style={{ marginTop: 20 }}
              disabled={action.isPending}
              onClick={() => {
                const reason = selectedReason ?? suggestedReason
                action.run(async () => {
                  await apis.planning.defer(selectingFor, reason)
                  setSelectingFor(null)
                  setSelectedReason(null)
                }, 'Deferral reason recorded')
              }}
            >
              Confirm reason
            </Button>
          </div>
        </div>
      </>
    )
  }

  // Main deferrals list
  return (
    <>
      <PageHeading
        title="Deferrals management"
        description={`${formatLongDate(clock.deliveryDate)} · Capacity exceptions require an auditable reason`}
      />
      <PlanningSteps current={2} />

      {priorityViolations.length > 0 && (
        <Notice tone="danger" title="Consecutive unserved day blocked">
          {priorityViolations[0].outlet} was skipped on the previous run. It cannot be deferred
          again. Allocate order {priorityViolations[0].id} to continue.
        </Notice>
      )}
      {!allRecorded && priorityViolations.length === 0 && deferred.length > 0 && (
        <Notice tone="warning" title="Reason codes required">
          Choose a reason for every deferred order. The plan cannot be published with an empty reason.
        </Notice>
      )}
      {allRecorded && (
        <Notice tone="success" title="All deferrals documented">
          {deferred.length === 1 ? 'The deferred order has' : `All ${deferred.length} deferred orders have`}{' '}
          a recorded reason. No outlet is left unserved two days running.
        </Notice>
      )}

      {deferred.length === 0 ? (
        <EmptyState
          title="No deferred orders"
          description="All confirmed orders are allocated. Proceed to review."
        />
      ) : (
        <div className="panel" style={{ marginTop: 16 }}>
          {/* Priority violation row at top */}
          {priorityViolations.map((o) => (
            <div
              key={o.id}
              className="deferral-priority-row"
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>
                  {o.id} · {o.outlet} · {o.brand} / {o.temperature}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 4, fontWeight: 500 }}>
                  Previous run: unserved · Deferral is unavailable today
                </p>
              </div>
              <Link to="/dispatcher/planning">
                <Button size="sm">Allocate priority order</Button>
              </Link>
            </div>
          ))}

          {/* Regular deferral rows */}
          {deferred
            .filter((o) => !o.priority)
            .map((o) => (
              <div key={o.id} className="deferral-row">
                <div className="deferral-order-info">
                  <p style={{ fontWeight: 600, fontSize: 14 }}>
                    {o.id} · {o.outlet}
                  </p>
                  <p style={{ fontSize: 13, color: '#6e737b', marginTop: 3 }}>
                    {o.brand} · {o.weight} kg · {o.volume} m³ · {o.temperature}
                  </p>
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: '#6e737b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: '#9ca0a8',
                          flexShrink: 0,
                        }}
                      />
                      Previous run served
                    </span>
                  </div>
                </div>
                <div className="deferral-reason-area">
                  <p style={{ fontSize: 12, color: '#6e737b', marginBottom: 6 }}>
                    Reason code · required
                  </p>
                  <button
                    className="reason-select-btn"
                    style={{
                      display: 'block',
                      width: '100%',
                      background: o.deferralReason ? 'var(--color-muted, #f5f4f2)' : 'var(--color-muted, #f5f4f2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: o.deferralReason ? 600 : 400,
                      cursor: data.settings.published ? 'default' : 'pointer',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                    disabled={data.settings.published}
                    onClick={() => {
                      setSelectingFor(o.id)
                      setSelectedReason(o.deferralReason ?? null)
                    }}
                  >
                    {o.deferralReason ?? 'Select a reason'}
                  </button>
                  {o.deferralReason ? (
                    <p style={{ fontSize: 12, color: '#6e737b', marginTop: 6 }}>
                      Evidence recorded against the locked capacity snapshot.
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 6 }}>
                      Select a reason before continuing.
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="deferral-footer">
        <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: priorityViolations.length
                ? 'var(--color-primary)'
                : allRecorded
                  ? '#22b563'
                  : '#9ca0a8',
              flexShrink: 0,
            }}
          />
          {priorityViolations.length
            ? `${priorityViolations.length} priority violation`
            : `${recordedCount} of ${deferred.length} reasons recorded`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/dispatcher/planning">
            <Button variant="outline">Return to allocation</Button>
          </Link>
          <Link to="/dispatcher/review">
            <Button disabled={!allRecorded && deferred.length > 0}>Review plan</Button>
          </Link>
        </div>
      </div>
    </>
  )
}

export function ReviewPage() {
  const { data } = useOperations(),
    apis = useApis(),
    clock = useBusinessClock(),
    action = useAction()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  useBreadcrumb(null)

  if (!data) return null

  const errors = publicationErrors(data)
  const deferred = data.orders.filter((o) => o.status === 'Deferred')
  const allocatedCount = data.orders.filter((o) => o.vehicleId).length
  const priorityViolations = deferred.filter((o) => o.priority).length
  const revNum = (data.settings.routeRevision ?? 3).toString().padStart(2, '0')

  const checks = [
    {
      title: 'Intake closed',
      valid: data.settings.cutoffClosed,
      desc: `Intake closed · ${data.orders.length} confirmed orders locked`,
    },
    {
      title: 'Vehicle constraints valid',
      valid: !errors.some((e) => /limit|refrigerated|demand|temperature/.test(e.toLowerCase())),
      desc: 'Weight and volume within limits · Chilled cargo assigned only to reefers',
    },
    {
      title: 'Trip limit valid',
      valid: !errors.some((e) => /trip/.test(e.toLowerCase())),
      desc: 'Every vehicle has at most two trips; return-to-depot timing checked',
    },
    deferred.length > 0
      ? {
          title: 'Deferrals reviewed',
          valid: deferred.every((o) => o.deferralReason),
          desc: deferred
            .filter((o) => o.deferralReason)
            .map((o) => o.deferralReason)
            .join(' · ') || 'Capacity deferrals documented',
        }
      : {
          title: 'All orders allocated',
          valid: !data.orders.some((o) => o.status === 'Confirmed' && !o.vehicleId),
          desc: `${allocatedCount} confirmed orders have valid trips. No deferrals are required.`,
        },
    {
      title: 'Priority outlets protected',
      valid: !deferred.some((o) => o.priority),
      desc: 'No outlet will be unserved on consecutive delivery days',
    },
  ]

  // Publish confirmation sub-view
  if (showConfirm) {
    return (
      <>
        <PageHeading title="Publish delivery plan" description={`Revision ${revNum} · Final confirmation`} />
        <PlanningSteps current={3} />
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-body">
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {allocatedCount} orders allocated.{deferred.length > 0 ? ` ${deferred.length} deferrals explained.` : ''}
            </h3>
            <p style={{ fontSize: 14, color: '#6e737b', lineHeight: 1.6, marginBottom: 20 }}>
              Publishing shares the approved route and stop sequence with loaders and drivers. Store
              managers can see their allocation or recorded deferral reason.
            </p>
            <Notice tone="warning" title="Departure is a separate step">
              Publishing does not release vehicles. Every departure still requires completed loading,
              resolved shortfalls, and an attached loading photograph.
            </Notice>
            <div className="publish-meta-grid">
              <div className="publish-meta-box">
                <p className="meta-value">{formatShortDate(clock.deliveryDate)}</p>
                <p className="meta-label">{formatWeekday(clock.deliveryDate)}</p>
              </div>
              <div className="publish-meta-box">
                <p className="meta-value">Revision {revNum}</p>
                <p className="meta-label">Replaces the previous draft</p>
              </div>
            </div>
            <Button
              className="w-full"
              style={{ marginTop: 8 }}
              disabled={action.isPending}
              onClick={() =>
                action.run(async () => {
                  await apis.planning.publish()
                  navigate('/dispatcher/release')
                }, 'Plan published. Proceed to departure readiness.')
              }
            >
              Publish revision {revNum}
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title="Review allocation"
        description={`Revision ${revNum} · ${formatLongDate(clock.deliveryDate)} · ${data.orders.length} confirmed orders`}
      />
      <PlanningSteps current={3} />

      {/* Stats */}
      <div className="metrics">
        <div className="metric">
          <span>Allocated</span>
          <strong style={allocatedCount === data.orders.length ? { color: 'inherit' } : {}}>
            {allocatedCount}
          </strong>
          <small>Every trip satisfies its constraints</small>
        </div>
        <div className="metric">
          <span>Deferred</span>
          <strong style={deferred.length > 0 ? { color: 'var(--color-primary)' } : {}}>{deferred.length}</strong>
          <small>{deferred.length === 0 ? 'No orders deferred' : 'Both reasons recorded'}</small>
        </div>
        <div className="metric">
          <span>Priority violations</span>
          <strong style={priorityViolations > 0 ? { color: 'var(--color-primary)' } : {}}>
            {priorityViolations}
          </strong>
          <small>
            {priorityViolations === 0
              ? 'No priority outlet is left unserved'
              : 'Resolve before publishing'}
          </small>
        </div>
      </div>

      <Panel title={errors.length === 0 ? 'Ready to publish' : 'Blockers remain'}>
        <div className="panel-body">
          {checks.map(({ title, valid, desc }) => (
            <div className="check-row" key={title}>
              {valid ? (
                <CheckCircle2 className="shrink-0" size={20} style={{ color: '#22b563' }} />
              ) : (
                <Circle className="shrink-0" size={20} style={{ color: '#9ca0a8' }} />
              )}
              <div style={{ flex: 1 }}>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Link to="/dispatcher/planning">
          <Button variant="outline">
            {data.settings.published ? 'View allocation' : 'Edit allocation'}
          </Button>
        </Link>
        {data.settings.published ? (
          <Link to="/dispatcher/release">
            <Button>
              Open departure readiness
              <ArrowRight size={16} />
            </Button>
          </Link>
        ) : !data.settings.allocationReviewed ? (
          <Button
            disabled={!!errors.length || action.isPending}
            onClick={() =>
              action.run(
                () => apis.planning.reviewAllocation(),
                'Allocation review recorded. Final publication is now available.',
              )
            }
          >
            <ShieldCheck size={16} />
            Confirm allocation review
          </Button>
        ) : deferred.length > 0 ? (
          <Button
            disabled={!!errors.length || action.isPending}
            onClick={() => setShowConfirm(true)}
          >
            Review publication
          </Button>
        ) : (
          <Button
            disabled={!!errors.length || action.isPending}
            onClick={() =>
              action.run(
                () => apis.planning.publish(),
                'Plan published. Loading proof is still required for departure.',
              )
            }
          >
            Publish plan
          </Button>
        )}
      </div>
    </>
  )
}

function loadStatusLabel(load: { released: boolean; completed: boolean; issueResolved: boolean }) {
  return load.released
    ? 'Released'
    : load.completed
      ? 'Ready for release'
      : !load.issueResolved
        ? 'Held'
        : 'Awaiting loading'
}

/** Load picker in the app's own style. Closes on choice, outside click or Escape. */
function LoadMenu({
  value,
  loads,
  onChange,
}: {
  value: string
  loads: Array<{ id: string; vehicleId: string; trip: number; released: boolean; completed: boolean; issueResolved: boolean }>
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = loads.find((load) => load.id === value)
  return (
    <div className="load-menu" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        className="load-menu-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false)
        }}
      >
        <span>
          {selected
            ? `${selected.vehicleId} · Trip ${selected.trip} · ${loadStatusLabel(selected)}`
            : 'Select a load'}
        </span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <ul className="load-menu-list" role="listbox">
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              className={`load-menu-option ${!value ? 'selected' : ''}`}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Select a load
            </button>
          </li>
          {loads.map((load) => (
            <li key={load.id} role="option" aria-selected={load.id === value}>
              <button
                type="button"
                className={`load-menu-option ${load.id === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(load.id)
                  setOpen(false)
                }}
              >
                {load.vehicleId} · Trip {load.trip} · {loadStatusLabel(load)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ReleasePage() {
  const { data } = useOperations()
  const clock = useBusinessClock()
  const [params, setParams] = useSearchParams()
  const loadId = params.get('loadId') ?? ''
  const revNum = (data?.settings.routeRevision ?? 3).toString().padStart(2, '0')
  useBreadcrumb(null)

  return (
    <>
      <PageHeading 
        title="Plan published" 
        description={`Revision ${revNum} · Published ${formatWeekday(clock.deliveryDate)} at ${clock.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Colombo' })} · Dispatcher`}
      />
      <PlanningSteps current={4} />
      <Panel title="Published loads">
        <div className="panel-body">
          <Field label="Vehicle and trip">
            <LoadMenu
              value={loadId}
              loads={data?.loads ?? []}
              onChange={(id) => setParams(id ? { loadId: id } : {})}
            />
          </Field>
        </div>
      </Panel>
      {loadId ? (
        <ReleaseLoad key={loadId} loadId={loadId} />
      ) : (
        <EmptyState
          title="Select a vehicle and trip"
          description="Review its loading record before authorizing departure."
        />
      )}
    </>
  )
}

function ReleaseLoad({ loadId }: { loadId: string }) {
  const { data } = useOperations(),
    apis = useApis(),
    action = useAction()
  const load = data?.loads.find((load) => load.id === loadId),
    { url } = useEvidence(load?.photoId)
  if (!data) return <Notice title="Loading readiness…" />
  if (!load) return <EmptyState title="Load not found" />
  const vehicle = data.vehicles.find((vehicle) => vehicle.id === load.vehicleId)
  const errors = departureErrors(data, load),
    cases = load.items.reduce((n, i) => n + i.loaded, 0),
    total = load.items.reduce((n, i) => n + i.expected, 0),
    revNum = load.revision.toString().padStart(2, '0'),
    deferred = data.orders.filter((o) => o.status === 'Deferred')
  return (
    <>
      {load.issue && !load.issueResolved && (
        <Notice title="Shortfall requires Dispatcher decision" tone="danger">
          {load.issue}
          <div className="mt-3">
            <Button
              disabled={action.isPending || load.released}
              onClick={() =>
                action.run(
                  () => apis.loading.resolveIssue(load.id),
                  'Replacement approved. Loader must acknowledge the revision and repeat checks.',
                )
              }
            >
              Approve replacement and revise load
            </Button>
          </div>
        </Notice>
      )}
      {errors.length > 0 && !load.released && (
        <Notice title="Awaiting loading evidence">{errors.join(' ')}</Notice>
      )}
      {load.released && (
        <Notice title="Vehicle released for departure" tone="success">
          The Driver workspace can now start the assigned route.
        </Notice>
      )}
      <div className="split-grid">
        <Panel
          title={`${load.vehicleId} · Trip ${load.trip} · ${vehicle?.type ?? 'Vehicle'}`}
          action={
            <StatusBadge>
              {load.released ? 'En route' : errors.length ? 'Held for proof' : 'Ready'}
            </StatusBadge>
          }
        >
          <div className="panel-body">
            <div className="check-row">
              <Truck size={19} />
              <div>
                <strong>Load sequence</strong>
                <small>
                  {cases} / {total} cases reconciled ·{' '}
                  {load.items.map((item) => item.outlet).join(' → ')}
                </small>
              </div>
            </div>
            <div className="check-row">
              <ShieldCheck size={19} />
              <div>
                <strong>Safety checks</strong>
                <small>
                  {Object.values(load.checks).filter(Boolean).length} / 3 confirmed ·{' '}
                  {load.issue && !load.issueResolved
                    ? 'Shortfall unresolved'
                    : 'No unresolved shortfalls'}
                </small>
              </div>
            </div>
            <CapacityBar
              label="Weight"
              used={data.orders
                .filter((o) => o.vehicleId === load.vehicleId && o.trip === load.trip)
                .reduce((n, o) => n + o.weight, 0)}
              total={vehicle?.weightCapacity ?? 1}
              unit="kg"
            />
            <CapacityBar
              label="Volume"
              used={data.orders
                .filter((o) => o.vehicleId === load.vehicleId && o.trip === load.trip)
                .reduce((n, o) => n + o.volume, 0)}
              total={vehicle?.volumeCapacity ?? 1}
              unit="m³"
            />
            <Button
              className="w-full mt-5"
              disabled={!!errors.length || load.released || action.isPending}
              onClick={() =>
                action.run(
                  () => apis.planning.release(load.id),
                  'Departure released in the local workspace',
                )
              }
            >
              {load.released
                ? 'Departure released'
                : `Dispatch ${load.vehicleId} · Trip ${load.trip}`}
            </Button>
          </div>
        </Panel>
        <Panel title="Loader handoff">
          <div className="panel-body">
            {url ? (
              <img src={url} alt="Loading proof attached by the Loader" className="proof-image" />
            ) : (
              <Notice title="Loading photograph not attached">
                The loader must complete checks and attach a clear photograph of the load.
              </Notice>
            )}
            <Link to={`/loader/loading/${load.id}`}>
              <Button variant="outline" className="w-full">
                Open Loader workspace
                <ArrowRight size={16} />
              </Button>
            </Link>
            {load.released && (
              <Link to="/driver/home">
                <Button variant="outline" className="w-full mt-3">
                  Open Driver workspace
                  <ArrowRight size={16} />
                </Button>
              </Link>
            )}
            {deferred.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {deferred.length} deferred orders
                </p>
                {deferred.map((o) => (
                  <p key={o.id} style={{ fontSize: 13, color: '#6e737b', marginBottom: 4 }}>
                    {o.outlet} · {o.deferralReason}
                  </p>
                ))}
                <p style={{ fontSize: 12, color: '#6e737b', marginTop: 8 }}>
                  They receive priority on the next run.
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
