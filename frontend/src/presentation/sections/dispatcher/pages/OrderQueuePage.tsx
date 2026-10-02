import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Package, Snowflake, Clock, ArrowRight } from 'lucide-react'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
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
import { OrderTable } from '../organisms/OrderTable'
import { PlanningSteps } from '../organisms/PlanningSteps'

export default function OrderQueuePage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction(),
    [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? ''),
    [status, setStatus] = useState('All'),
    [selected, setSelected] = useState<string | null>(null)
  if (!data) return null
  const orders = data.orders.filter(
    (o) =>
      `${o.id} ${o.outlet} ${o.outletName}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'All' || o.status === status),
  )
  const order = data.orders.find((o) => o.id === selected),
    closed = data.settings.cutoffClosed
  return (
    <>
      <PageHeading
        title="Order queue"
        description="Delivery · Saturday, 26 September · Friday intake closes at 16:00"
        action={
          <Link to="/dispatcher/planning">
            <Button variant="outline">
              Open allocation
              <ArrowRight size={16} />
            </Button>
          </Link>
        }
      />
      <PlanningSteps current={0} />
      <div className="metrics">
        <Metric
          label="Confirmed orders"
          value={data.orders.length}
          detail={['Fresh', 'Style', 'Tech']
            .map((b) => `${data.orders.filter((o) => o.brand === b).length} ${b}`)
            .join(' · ')}
          icon={<Package size={17} />}
        />
        <Metric
          label="Temperature controlled"
          value={data.orders.filter((o) => o.temperature === 'Chilled').length}
          detail="Chilled orders require a reefer"
          icon={<Snowflake size={17} />}
        />
        <Metric
          label="Cutoff"
          value={closed ? 'Closed' : '18 min'}
          detail={closed ? '16:00 · Intake locked for review' : '15:42 · Orders can still change'}
          icon={<Clock size={17} />}
        />
      </div>
      <div className="toolbar">
        <div className="flex items-center gap-3">
          <StatusBadge tone={closed ? 'neutral' : 'success'}>
            {closed ? 'Intake closed' : 'Accepting orders'}
          </StatusBadge>
          <span className="text-xs text-muted-foreground hidden lg:block">
            All demand in one operational view
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.run(() => service.repository.getSnapshot(), 'Queue refreshed')}
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
                {s}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-[240px]">
            <SearchField value={search} onChange={setSearch} placeholder="Order or outlet" />
          </div>
        </div>
        <OrderTable
          orders={orders}
          compact={data.settings.compactRows}
          onSelect={(o) => setSelected(o.id)}
        />
      </Panel>
      {!closed && (
        <Notice title="Publishing becomes available after the 16:00 cutoff." tone="neutral">
          Use Demo scenarios to explore the closed-intake state.
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
