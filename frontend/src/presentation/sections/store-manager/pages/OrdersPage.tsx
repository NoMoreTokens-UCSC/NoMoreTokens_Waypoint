import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchField } from '../../../shared/molecules/Common'
import { formatClock } from '../../../../domain/calendar'
import type { Order } from '../../../../domain/models'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { CutoffPanel } from '../components/CutoffPanel'
import { ParcelIcon } from '../components/StoreIcons'
import { Action, OfflineNotice, PageIntro, Pill, StorePage, Tile } from '../components/StoreKit'
import { cutoffLabel } from '../lib/cutoff'
import {
  deliveryDayLabel,
  filters,
  isOpen,
  matchesFilter,
  matchesQuery,
  pageSize,
  needsAttention,
  receiptLabel,
  type OrderFilter,
} from '../lib/orderList'
import {
  orderKinds,
  quantityText,
  statusTone,
  storeStatus,
  temperatures,
  windowText,
} from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { useStoreHistory, useStoreOrders } from '../lib/useStore'

function OrderRow({ order }: { order: Order }) {
  const kind = orderKinds[order.temperature]
  const receipt = receiptLabel(order)
  return (
    <li>
      <Link className="sm-order-row" to={`/store-manager/orders/${order.id}`}>
        <span className="sm-mark">
          <ParcelIcon size={24} />
        </span>
        <span className="sm-order-main">
          <strong>{kind.title}</strong>
          <small>
            {order.id}
            {order.deliveredAt ? ` · Delivered ${formatClock(order.deliveredAt)}` : ''}
          </small>
        </span>
        <span className="sm-order-quantity">
          {quantityText(order)}
          <small>Window {windowText(order)}</small>
        </span>
        <span className="sm-order-status">
          <Pill tone={statusTone(order)}>{storeStatus(order)}</Pill>
          {receipt && <Pill tone={receipt.tone}>{receipt.text}</Pill>}
        </span>
      </Link>
    </li>
  )
}

/** Orders: the next delivery's orders, then every earlier order, with where each one ended up. */
export default function OrdersPage() {
  const clock = useBusinessClock()
  const online = useOnline()
  const { orders, outletId, loaded } = useStoreOrders()
  const { history, loaded: historyLoaded } = useStoreHistory()
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  if (!loaded || !historyLoaded) return null
  const all = [...orders, ...history]
  const matching = all.filter(
    (order) => matchesFilter(order, filter) && matchesQuery(order, query, clock),
  )
  const pages = Math.max(1, Math.ceil(matching.length / pageSize))
  const current = Math.min(page, pages)
  const shown = matching.slice((current - 1) * pageSize, current * pageSize)
  // Grouped by delivery day, newest first; the live orders (next run) come first.
  const groups: { label: string; next: boolean; orders: Order[] }[] = []
  for (const order of shown) {
    const label = deliveryDayLabel(order, clock)
    const group = groups.find((candidate) => candidate.label === label)
    if (group) group.orders.push(order)
    else groups.push({ label, next: !order.deliveryDate, orders: [order] })
  }
  return (
    <StorePage>
      <PageIntro title="Orders" context={`${outletId} · ${all.length} Fresh orders on record`} />
      {!online && <OfflineNotice cutoff={cutoffLabel(clock.cutoff)} />}
      <CutoffPanel clock={clock} />
      <section className="sm-panel" aria-label="Order summary">
        <div className="sm-totals">
          <Tile size="sm" label="Open" value={all.filter(isOpen).length} />
          <Tile size="sm" label="Needs attention" value={all.filter(needsAttention).length} />
          <Tile
            size="sm"
            label="Completed"
            value={all.filter((order) => matchesFilter(order, 'done')).length}
          />
        </div>
        <div className="sm-filter-bar">
          <div className="sm-segments sm-filters" role="group" aria-label="Show orders">
            {filters.map((option) => (
              <Action
                key={option.value}
                small
                variant={filter === option.value ? 'primary' : 'outline'}
                aria-pressed={filter === option.value}
                onClick={() => {
                  setFilter(option.value)
                  setPage(1)
                }}
              >
                {option.label}
              </Action>
            ))}
          </div>
          {matching.length > pageSize && (
            <nav className="sm-pager" aria-label="Order pages">
              <Action
                small
                variant="outline"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Action>
              <span aria-live="polite">
                Page {current} of {pages}
              </span>
              <Action
                small
                variant="outline"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Action>
            </nav>
          )}
        </div>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
          placeholder="Search order, day or status"
          label="Search orders"
        />
      </section>
      {groups.length === 0 ? (
        <section className="sm-panel">
          <h2 className="sm-h22">No orders here</h2>
          <p className="sm-muted">Nothing matches this view. Clear the search or try “All”.</p>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="sm-group" aria-label={group.label}>
            <h2>
              {group.label}
              {group.next && <span> · Next delivery</span>}
            </h2>
            <ul className="sm-order-list">
              {/* Chilled first, as on the overview. */}
              {[...group.orders]
                .sort(
                  (a, b) =>
                    temperatures.indexOf(a.temperature) - temperatures.indexOf(b.temperature),
                )
                .map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
            </ul>
          </section>
        ))
      )}
    </StorePage>
  )
}
