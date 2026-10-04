import { orderNumber } from '../lib/orderView'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatClock, formatShortDate } from '../../../../domain/calendar'
import { Action, ActionLink, PageIntro, Pill, StorePage } from '../components/StoreKit'
import {
  actionsNeeded,
  buildFeed,
  feedFilters,
  reportedIssues,
  type FeedKind,
} from '../lib/notifications'
import { durationText, lateOrders } from '../lib/lateness'
import { issueReference, kindSlash } from '../lib/orderView'
import { useStoreHistory, useStoreOrders, useStoreStops } from '../lib/useStore'
import { DeliveryAlerts } from '../../../shared/organisms/DeliveryAlerts'

const pageSize = 12

/** Notifications: what needs the store now, how reported issues stand, and everything that happened. */
export default function NotificationsPage() {
  const { orders, outletId, loaded } = useStoreOrders()
  const { history, loaded: historyLoaded } = useStoreHistory()
  const { stops } = useStoreStops()
  const [filter, setFilter] = useState<FeedKind | 'all'>('all')
  const [shown, setShown] = useState(pageSize)
  if (!loaded || !historyLoaded) return null
  const all = [...orders, ...history]
  const todo = actionsNeeded(all)
  const issues = reportedIssues(all)
  const feed = buildFeed(all).filter((event) => filter === 'all' || event.kind === filter)
  const late = lateOrders(orders, stops)
  const waiting = todo.deferrals.length + todo.receipts.length
  return (
    <StorePage>
      <PageIntro
        title="Notifications"
        context={`${outletId} · ${waiting ? `${waiting} order${waiting === 1 ? '' : 's'} need${waiting === 1 ? 's' : ''} your attention` : 'Delivery updates and order activity'}`}
      />
      <DeliveryAlerts />
      {late.length > 0 && (
        <section className="sm-panel" aria-label="Running late">
          <h2 className="sm-h22">Running late</h2>
          <ul className="sm-feed">
            {late.map(({ order, late: delay }) => (
              <li key={order.id}>
                <div>
                  <strong>
                    {orderNumber(order)} is expected {durationText(delay.minutesLate)} after your window
                  </strong>
                  <small>
                    Expected {delay.expected} · window ends {delay.windowEnd}
                  </small>
                </div>
                <ActionLink small to={`/store-manager/deliveries?order=${order.id}`}>
                  Track delivery
                </ActionLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      {waiting > 0 && (
        <section className="sm-panel" aria-label="Needs your action">
          <h2 className="sm-h22">Needs your action</h2>
          <ul className="sm-feed">
            {todo.deferrals.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>{orderNumber(order)} was deferred</strong>
                  <small>{order.deferralReason ?? 'Moved to the next run'} · acknowledge it</small>
                </div>
                <ActionLink small to="/store-manager/alerts">
                  Acknowledge
                </ActionLink>
              </li>
            ))}
            {todo.receipts.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>{orderNumber(order)} was delivered</strong>
                  <small>Count the goods and confirm receipt or report a problem</small>
                </div>
                <ActionLink small to={`/store-manager/deliveries/${order.id}/receipt`}>
                  Confirm receipt
                </ActionLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sm-panel" aria-label="Issues you reported">
        <h2 className="sm-h22">Issues you reported</h2>
        {issues.length === 0 ? (
          <p className="sm-muted">
            No issues reported. Missing or damaged goods will be tracked here.
          </p>
        ) : (
          <>
            <ul className="sm-feed">
              {issues.map((order) => {
                const report = order.receiptReport!
                return (
                  <li key={order.id}>
                    <div>
                      <strong>
                        {issueReference(order, report.kind)} · {report.kind} items
                      </strong>
                      <small>
                        {orderNumber(order)} · {kindSlash(order)} · {report.affected} of {order.cases} cases ·
                        reported {formatShortDate(report.recordedAt)}
                      </small>
                    </div>
                    <Pill tone="amber">Open · Awaiting review</Pill>
                    <Link className="sm-feed-link" to={`/store-manager/orders/${order.id}`}>
                      View order
                    </Link>
                  </li>
                )
              })}
            </ul>
            <p className="sm-muted sm-small">
              The dispatcher reviews each report with the driver’s delivery record. The outcome will
              show here once it is recorded.
            </p>
          </>
        )}
      </section>

      <section className="sm-panel" aria-label="Activity">
        <h2 className="sm-h22">Activity</h2>
        <div className="sm-segments sm-filters" role="group" aria-label="Show activity">
          {feedFilters.map((option) => (
            <Action
              key={option.value}
              small
              variant={filter === option.value ? 'primary' : 'outline'}
              aria-pressed={filter === option.value}
              onClick={() => {
                setFilter(option.value)
                setShown(pageSize)
              }}
            >
              {option.label}
            </Action>
          ))}
        </div>
        {feed.length === 0 ? (
          <p className="sm-muted">Nothing here yet.</p>
        ) : (
          <ul className="sm-feed">
            {feed.slice(0, shown).map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </div>
                <time dateTime={event.at}>
                  {formatShortDate(event.at)} · {formatClock(event.at)}
                </time>
                <Link className="sm-feed-link" to={`/store-manager/orders/${event.orderId}`}>
                  View order
                </Link>
              </li>
            ))}
          </ul>
        )}
        {feed.length > shown && (
          <Action variant="outline" onClick={() => setShown(shown + pageSize)}>
            Show earlier activity ({feed.length - shown} more)
          </Action>
        )}
      </section>
    </StorePage>
  )
}
