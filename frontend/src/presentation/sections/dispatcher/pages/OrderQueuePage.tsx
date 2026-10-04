import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Package, Snowflake, Clock, ArrowRight, PackageCheck, CalendarClock, PackageX } from 'lucide-react'
import { useAction } from '../../../hooks/useOperations'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useApis } from '../../../providers/ApisContext'
import {
  PageHeading,
  Metric,
  SearchField,
  Panel,
  StatusBadge,
  Modal,
  Notice,
} from '../../../shared/molecules/Common'
import { Button } from '../../../shared/atoms/button'
import { formatLongDate } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { OrderTable } from '../organisms/OrderTable'
import { PlanningSteps } from '../organisms/PlanningSteps'

export default function OrderQueuePage() {
  const apis = useApis(),
    clock = useBusinessClock(),
    action = useAction(),
    [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? ''),
    [status, setStatus] = useState('All'),
    [selected, setSelected] = useState<string | null>(null)
  // The delivery day in Sri Lanka time, so the queue matches the plan being worked on.
  const deliveryDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(clock.deliveryDate)
  // The queue comes from the orders API, so the page never scans the whole workspace.
  const queue = useApiQuery(['orders', 'queue', deliveryDay], (api) => api.orders.listOrders({ date: deliveryDay }))
  const all = queue.data ?? []
  const account = useApiQuery(['account', 'settings'], (api) => api.account.getSettings())
  if (queue.isPending) return null
  if (queue.isError) {
    return (
      <>
        <PageHeading title="Orders" description="Turn incoming demand into a feasible delivery plan." />
        <Notice title="The order queue could not be loaded" tone="danger">
          Check the connection to the server, then refresh the page.
        </Notice>
      </>
    )
  }
  const orders = all.filter(
    (o) =>
      `${o.id} ${o.outlet} ${o.outletName}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'All' || o.status === status),
  )
  const order = all.find((o) => o.id === selected),
    closed = clock.cutoffClosed,
    deferred = all.filter((o) => o.status === 'Deferred').length,
    unassigned = all.filter((o) => !o.vehicleId && o.status !== 'Deferred').length
  return (
    <>
      <PageHeading
        eyebrow={`Dispatch · ${formatLongDate(clock.deliveryDate)}`}
        title="Orders"
        description="Turn incoming demand into a feasible delivery plan."
        action={
          <Link to="/dispatcher/planning">
            <Button>
              Start allocation
              <ArrowRight size={16} />
            </Button>
          </Link>
        }
      />
      <PlanningSteps current={0} />
      <div className="metrics four">
        <Metric
          label={closed ? 'Confirmed' : 'Incoming'}
          value={all.length}
          detail={closed ? 'Fixed after cutoff' : 'Total confirmed orders'}
          icon={closed ? <PackageCheck size={17} /> : <Package size={17} />}
        />
        {!closed && (
          <Metric
            label="Chilled"
            value={all.filter((o) => o.temperature === 'Chilled').length}
            detail="Chilled orders require a reefer"
            icon={<Snowflake size={17} />}
          />
        )}
        <Metric label="Deferred" value={deferred} detail="Orders moved to the next run" icon={<CalendarClock size={17} />} />
        {closed && (
          <Metric
            label="Unassigned"
            value={unassigned}
            detail="Orders still needing a trip"
            icon={<PackageX size={17} />}
          />
        )}
        {closed && (
          <Metric
            label="Chilled"
            value={all.filter((o) => o.temperature === 'Chilled').length}
            detail="Chilled orders require a reefer"
            icon={<Snowflake size={17} />}
          />
        )}
        {!closed && (
          <Metric
            label="Cutoff"
            value="Open"
            detail="Orders can change until intake closes"
            icon={<Clock size={17} />}
          />
        )}
      </div>
      <div className="toolbar">
        <div className="flex items-center gap-3">
          <StatusBadge tone={closed ? 'neutral' : 'success'}>
            {closed ? 'Intake closed' : 'Accepting orders'}
          </StatusBadge>
          {!closed && (
            <Button
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.run(
                  async () => {
                    await apis.planning.closeIntake()
                  },
                  'Intake closed. Orders locked for allocation.',
                )
              }
            >
              Close intake
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.run(() => queue.refetch(), 'Queue refreshed')}
        >
          <RefreshCw size={14} />
          Refresh queue
        </Button>
      </div>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="filter-tabs">
            {['All', 'Confirmed', 'Allocated', 'Deferred', 'Scheduled'].map((s) => (
              <button
                key={s}
                className={`filter-tab ${status === s ? 'selected' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s}{' '}
                <span className="ml-1 text-[10px] opacity-60">
                  {s === 'All' ? all.length : all.filter((o) => o.status === s).length}
                </span>
              </button>
            ))}
          </div>
          <div className="w-full sm:w-[240px]">
            <SearchField value={search} onChange={setSearch} placeholder="Order, outlet or brand" />
          </div>
        </div>
        <OrderTable
          orders={orders}
          compact={account.data?.compactRows ?? false}
          onSelect={(o) => setSelected(o.id)}
        />
      </Panel>
      {!closed && (
        <Notice title="Publishing becomes available after intake closes." tone="neutral">
          Close intake when the order window ends. Allocation can start from then.
        </Notice>
      )}
      <Modal
        side
        title={order?.id ?? 'Order details'}
        description={order ? `${order.outlet} · ${order.outletName}` : undefined}
        open={!!order}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {order && (
          <>
            <StatusBadge>{order.status}</StatusBadge>
            <div className="grid gap-5 my-4">
              {[
                ['Demand type', order.brand],
                ['Temperature', order.temperature],
                ['Volume', `${order.volume} m³`],
                ['Weight', `${order.weight} kg`],
                ['Cases', order.cases],
                ['Delivery window', order.window],
                [
                  'Allocation',
                  order.vehicleId ? `${order.vehicleId} · Trip ${order.trip}` : 'Not allocated',
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-3 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <strong className="font-medium">{value}</strong>
                </div>
              ))}
            </div>
            {order.priority && (
              <Notice title="Protect this outlet’s priority">
                It was previously skipped and must be served this run.
              </Notice>
            )}
            {order.deferralReason && (
              <Notice title="Deferral reason">{order.deferralReason}</Notice>
            )}
            <Link to="/dispatcher/planning" onClick={() => setSelected(null)}>
              <Button className="w-full">
                Review allocation
                <ArrowRight size={16} />
              </Button>
            </Link>
          </>
        )}
      </Modal>
    </>
  )
}
