import { useRef, type ReactNode } from 'react'
import { ArrowRight, Check, CircleAlert, Search, X } from 'lucide-react'
import { Button } from '../atoms/button'
import { Input } from '../atoms/input'
import { Badge } from '../atoms/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../atoms/dialog'
import { cn } from '../lib/utils'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function Metric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string
  value: ReactNode
  detail?: string
  icon?: ReactNode
  tone?: string
}) {
  return (
    <div className="metric">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <strong className={tone}>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}
export function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'orange'
}) {
  const text = String(children)
  const inferred =
    tone ??
    (/Confirmed|Delivered|Active|Available|accepted|complete|Ready|Cleared/.test(text)
      ? 'success'
      : /Offline|Deferred|pending|review|Held|Invited|Loading/.test(text)
        ? 'warning'
        : /retry|Suspended|Cannot/.test(text)
          ? 'danger'
          : /route|Allocated|Scheduled/.test(text)
            ? 'orange'
            : 'neutral')
  return (
    <Badge variant="outline" className={cn('status', `status-${inferred}`)}>
      <span className="status-dot" />
      {children}
    </Badge>
  )
}
export function Notice({
  title,
  children,
  tone = 'warning',
}: {
  title: string
  children?: ReactNode
  tone?: 'warning' | 'success' | 'neutral' | 'danger'
}) {
  return (
    <div role="status" className={cn('notice', `notice-${tone}`)}>
      <CircleAlert size={18} className="shrink-0 mt-0.5" />
      <div>
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search records',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
      <Input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          className="absolute right-3 top-3"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Check size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function CapacityBar({
  label,
  used,
  total,
  unit = '',
}: {
  label: string
  used: number
  total: number
  unit?: string
}) {
  const ratio = Math.round((used / total) * 100)
  return (
    <div className="capacity">
      <div>
        <span>{label}</span>
        <strong>
          {used.toFixed(unit === 'm³' ? 1 : 0)} / {total} {unit}
        </strong>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.min(ratio, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="capacity-track"
      >
        <span
          className={ratio > 100 ? 'bg-destructive' : ratio > 80 ? 'bg-primary' : 'bg-success'}
          style={{ width: `${Math.min(ratio, 100)}%` }}
        />
      </div>
    </div>
  )
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('panel', className)}>
      {title && (
        <header className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  side,
}: {
  title: string
  description?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
  side?: boolean
}) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
        }}
        className={cn(
          'max-h-[90dvh] overflow-y-auto',
          side &&
            '!left-auto !right-0 !top-0 !translate-x-0 !translate-y-0 h-dvh !max-h-dvh sm:max-w-[440px] rounded-none content-start',
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? 'Review the details below.'}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
export function NextButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button {...props}>
      {children}
      <ArrowRight size={16} />
    </Button>
  )
}
