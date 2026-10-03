import { DriverLocationControl } from '../molecules/DriverLocationControl'
import { DriverPwaStatus } from '../molecules/DriverPwaStatus'
import type { ReactNode } from 'react'
import { DriverButton as Button } from '../atoms/DriverButton'
import { PageHeading, Notice } from '../../../shared/molecules/Common'
import { cn } from '../../../shared/lib/utils'

export function DriverScreen({
  title,
  description,
  loading,
  error,
  retry,
  narrow,
  children,
}: {
  title: string
  description?: string
  loading?: boolean
  error?: Error | null
  retry?: () => void
  narrow?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'driver-screen flex min-w-0 flex-col gap-4 [&_.page-heading]:mb-0! [&_.panel]:rounded-xl! max-[760px]:[&_h1]:text-[22px]! max-[760px]:[&_h1]:leading-[30px]!',
        narrow && 'mx-auto w-full max-w-[760px]',
      )}
    >
      <PageHeading title={title} description={description} />
      <p className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
        Demo workspace · upload acknowledgements are simulated. No server is connected.
      </p>
      <DriverLocationControl />
      <DriverPwaStatus />
      {loading ? (
        <p role="status">Opening your saved route…</p>
      ) : error ? (
        <Notice title="Your route could not be opened" tone="danger">
          {error.message}
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </Notice>
      ) : (
        children
      )}
      <p className="py-2 text-center text-xs leading-relaxed text-muted-foreground">
        Use these controls only when safely stopped or parked.
      </p>
    </div>
  )
}
