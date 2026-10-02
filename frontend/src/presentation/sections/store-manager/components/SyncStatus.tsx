import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { snapshotKey } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { removeItem, setItem, useOutbox, waitingItems } from '../lib/outbox'
import { deliver } from '../lib/outboxSend'
import { useOnline } from '../lib/useOnline'
import { useStoreOutlet } from '../lib/useStore'
import { Action } from './StoreKit'
import { AlertIcon } from './StoreIcons'

const plural = (count: number) => `${count} change${count === 1 ? '' : 's'}`

/**
 * Sends what was saved while offline, as soon as the connection is back, and says what is waiting
 * or needs attention. Shown at the top of every store screen; nothing appears when all is sent.
 */
export function SyncStatus() {
  const apis = useApis()
  const client = useQueryClient()
  const online = useOnline()
  const outletId = useStoreOutlet()
  const items = useOutbox(outletId)
  const busy = useRef(false)
  const waiting = items.filter((item) => item.status === 'waiting' || item.status === 'sending')

  const flush = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    let sent = 0
    try {
      for (const item of waitingItems(outletId)) {
        setItem(item.id, { status: 'sending' })
        try {
          const result = await deliver(apis, outletId, item.request)
          if (result.status === 'sent') {
            removeItem(item.id)
            sent += 1
          } else setItem(item.id, { status: 'draft', message: result.message })
        } catch (error) {
          setItem(item.id, {
            status: 'failed',
            message: error instanceof Error ? error.message : 'It could not be sent.',
          })
        }
      }
      await client.invalidateQueries({ queryKey: snapshotKey })
      if (sent) toast.success(`${plural(sent)} sent`)
    } finally {
      busy.current = false
    }
  }, [apis, client, outletId])
  const waitingCount = waitingItems(outletId).length
  useEffect(() => {
    if (online && waitingCount) void flush()
  }, [online, waitingCount, flush])

  if (!items.length) return null
  const sending = waiting.some((item) => item.status === 'sending')
  return (
    <section className="sm-sync" aria-label="Sending status">
      {waiting.length > 0 && (
        <div className="sm-sync-row" role="status">
          <AlertIcon tone="warning" />
          <div>
            <strong>{sending ? 'Sending…' : `${plural(waiting.length)} waiting to send`}</strong>
            <p>
              {online
                ? 'Sending now.'
                : 'Saved on this device. They are sent automatically when you are back online; dispatch cannot see them until then.'}
            </p>
            <ul>
              {waiting.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </div>
          {online && !sending && (
            <Action small variant="outline" onClick={() => void flush()}>
              Send now
            </Action>
          )}
        </div>
      )}
      {items
        .filter((item) => item.status === 'failed' || item.status === 'draft')
        .map((item) => (
          <div className="sm-sync-row" role="alert" key={item.id}>
            <AlertIcon tone={item.status === 'failed' ? 'danger' : 'warning'} />
            <div>
              <strong>
                {item.status === 'failed' ? 'Not sent' : 'Kept as a draft'} · {item.title}
              </strong>
              <p>{item.message}</p>
            </div>
            <span className="sm-sync-actions">
              {item.status === 'failed' && (
                <Action
                  small
                  variant="outline"
                  onClick={() => {
                    setItem(item.id, { status: 'waiting', message: undefined })
                  }}
                >
                  Try again
                </Action>
              )}
              <Action small variant="grey" onClick={() => removeItem(item.id)}>
                Dismiss
              </Action>
            </span>
          </div>
        ))}
    </section>
  )
}
