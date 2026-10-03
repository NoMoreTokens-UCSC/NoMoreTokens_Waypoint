import type { ComponentProps } from 'react'
import { Button } from '../../../shared/atoms/button'
import { cn } from '../../../shared/lib/utils'

/** Touch-sized shared control, including buttons rendered in dialog portals. */
export function DriverButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button className={cn('h-auto min-h-11 whitespace-normal text-center', className)} {...props} />
  )
}
