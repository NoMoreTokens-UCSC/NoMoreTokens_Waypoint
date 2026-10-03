import { useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from 'lucide-react'
import type { Order } from '../../../../domain/models'
import { Button } from '../../../shared/atoms/button'
import { StatusBadge } from '../../../shared/molecules/Common'

export function OrderTable({
  orders,
  onSelect,
  compact = false,
}: {
  orders: Order[]
  onSelect: (order: Order) => void
  compact?: boolean
}) {
  const [sort, setSort] = useState<'window' | 'volume' | 'weight' | 'temperature'>('window')
  const [descending, setDescending] = useState(false),
    [page, setPage] = useState(0)
  const sorted = [...orders].sort((a, b) => {
    const left = a[sort],
      right = b[sort]
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    return descending ? -result : result
  })
  const current = Math.min(page, Math.max(0, Math.ceil(orders.length / 10) - 1))
  const sortBy = (key: typeof sort) => {
    if (key === sort) setDescending(!descending)
    else {
      setSort(key)
      setDescending(false)
    }
    setPage(0)
  }
  return (
    <>
      <div className="table-scroll">
        <table className="data-table order-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Outlet</th>
              <th>Brand</th>
              {(
                [
                  ['window', 'Delivery window'],
                  ['volume', 'Volume · m³'],
                  ['weight', 'Weight · kg'],
                  ['temperature', 'Temperature'],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
                >
                  <button
                    className={sort === key ? 'sort-active' : undefined}
                    onClick={() => sortBy(key)}
                  >
                    {label}
                    {sort === key &&
                      (descending ? (
                        <ArrowDown className="sort-arrow" size={12} />
                      ) : (
                        <ArrowUp className="sort-arrow" size={12} />
                      ))}
                  </button>
                </th>
              ))}
              <th>Plan status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(current * 10, current * 10 + 10).map((o) => (
              <tr
                key={o.id}
                className={`order-row ${compact ? 'compact' : ''}`}
                data-brand={o.brand.toLowerCase()}
                onClick={() => onSelect(o)}
              >
                <td>
                  <button className="table-link" onClick={() => onSelect(o)}>
                    {o.id}
                  </button>
                  {o.priority && (
                    <small className="!text-primary">Priority · previously skipped</small>
                  )}
                </td>
                <td>{o.outlet}</td>
                <td>
                  <span className={`brand-pill ${o.brand.toLowerCase()}`}>{o.brand}</span>
                </td>
                <td>{o.window}</td>
                <td>{o.volume.toFixed(1)} m³</td>
                <td>{o.weight} kg</td>
                <td>
                  {o.temperature === 'Chilled' ? (
                    <span className="text-[#5185a2]">Chilled</span>
                  ) : (
                    o.temperature
                  )}
                </td>
                <td>
                  <StatusBadge>{o.status}</StatusBadge>
                </td>
                <td className="order-row-action">
                  <span className="row-arrow">
                    <ChevronRight size={16} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <div className="empty-state">
            <h3>No matching orders</h3>
            <p>Try another outlet, order number, or status.</p>
          </div>
        )}
      </div>
      <footer className="table-footer">
        <span>
          {orders.length
            ? `${current * 10 + 1}–${Math.min(current * 10 + 10, orders.length)} of ${orders.length}`
            : '0'}{' '}
          orders
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous orders"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next orders"
            disabled={(current + 1) * 10 >= orders.length}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </footer>
    </>
  )
}
