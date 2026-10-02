import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { AlertIcon, CheckIcon } from './StoreIcons'
import { SyncStatus } from './SyncStatus'
import '../store.css'

/** Page wrapper: applies the store theme and the Figma vertical rhythm. */
export function StorePage({ children }: { children: ReactNode }) {
  return (
    <div className="sm-page">
      <SyncStatus />
      {children}
    </div>
  )
}

export function PageIntro({ title, context }: { title: string; context?: ReactNode }) {
  return (
    <header className="sm-intro">
      <h1>{title}</h1>
      {context && <p>{context}</p>}
    </header>
  )
}

export function Callout({
  tone = 'warning',
  title,
  children,
}: {
  tone?: 'warning' | 'success' | 'danger'
  title: string
  children?: ReactNode
}) {
  return (
    <div className="sm-callout" role={tone === 'danger' ? 'alert' : 'status'}>
      {tone === 'success' ? (
        <CheckIcon />
      ) : (
        <AlertIcon tone={tone === 'danger' ? 'danger' : 'warning'} />
      )}
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  )
}

/** White pill with a coloured dot: "En route", "Draft saved", "Chilled groceries". */
export function Pill({
  tone = 'green',
  children,
}: {
  tone?: 'green' | 'orange' | 'red' | 'amber'
  children: ReactNode
}) {
  return (
    <span className="sm-pill">
      <i className={`sm-dot sm-dot-${tone}`} aria-hidden="true" />
      {children}
    </span>
  )
}

/** A small labelled value on a white tile: "Expected arrival / 05:40". */
export function Tile({
  label,
  value,
  size = 'md',
  tone,
  big,
}: {
  label: string
  value: ReactNode
  size?: 'sm' | 'md' | 'lg'
  tone?: 'success'
  big?: boolean
}) {
  return (
    <div
      className={`sm-tile sm-tile-${size}${tone ? ` sm-tile-${tone}` : ''}${big ? ' sm-tile-big' : ''}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type Variant = 'primary' | 'grey' | 'outline'
const classes = (variant: Variant, small?: boolean, className?: string) =>
  ['sm-btn', `sm-btn-${variant}`, small ? 'sm-btn-small' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

export function Action({
  variant = 'primary',
  small,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return <button type="button" className={classes(variant, small, className)} {...props} />
}
export function ActionLink({
  variant = 'primary',
  small,
  className,
  ...props
}: LinkProps & { variant?: Variant; small?: boolean }) {
  return <Link className={classes(variant, small, className)} {...props} />
}

export function FieldInput({
  label,
  error,
  hint,
  ...input
}: {
  label: string
  error?: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="sm-field">
      <span>{label}</span>
      <input aria-invalid={Boolean(error)} {...input} />
      {error ? <small role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  )
}

/** A whole-number field with minus and plus buttons, so a count can be set without typing. */
export function StepperField({
  label,
  unit,
  value,
  error,
  onChange,
  onStep,
}: {
  label: string
  /** What one step adds, for the button labels: "case". */
  unit: string
  value: string
  error?: string
  onChange: (value: string) => void
  onStep: (by: number) => void
}) {
  return (
    <div className="sm-field">
      <span id={`stepper-${label}`}>{label}</span>
      <div className="sm-stepper">
        <button type="button" aria-label={`Remove one ${unit}`} onClick={() => onStep(-1)}>
          −
        </button>
        <input
          inputMode="numeric"
          aria-labelledby={`stepper-${label}`}
          aria-invalid={Boolean(error)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" aria-label={`Add one ${unit}`} onClick={() => onStep(1)}>
          +
        </button>
      </div>
      {error && <small role="alert">{error}</small>}
    </div>
  )
}

/** Shown while the device has no connection: what is and is not true about an order made now. */
export function OfflineNotice({ cutoff }: { cutoff: string }) {
  return (
    <Callout title="You’re offline">
      Your order is saved on this device. Dispatch cannot see it until your connection returns, and
      orders close at {cutoff}, so reconnect before then.
    </Callout>
  )
}
