import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { toast } from 'sonner'
import { Link, type LinkProps } from 'react-router-dom'
import { copyText } from '../lib/credentials'
import type { Paging } from '../lib/paging'
import '../admin.css'

/** Page wrapper: the administration theme and vertical rhythm. */
export function AdminPage({ children }: { children: ReactNode }) {
  return <div className="ad-page">{children}</div>
}

/** Kicker ("ADMINISTRATION · TEAM & ACCESS"), title and lead, with room for actions on the right. */
export function AdminIntro({
  kicker,
  title,
  lead,
  aside,
}: {
  kicker?: string
  title: string
  lead?: string
  aside?: ReactNode
}) {
  return (
    <header className="ad-intro">
      <div>
        {kicker && <p className="ad-kicker">{kicker}</p>}
        <h1>{title}</h1>
        {lead && <p className="ad-lead">{lead}</p>}
      </div>
      {aside && <div className="ad-intro-aside">{aside}</div>}
    </header>
  )
}

export function Card({
  children,
  label,
  className = '',
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <section className={`ad-card ${className}`} aria-label={label}>
      {children}
    </section>
  )
}
export const CardLabel = ({ children }: { children: ReactNode }) => (
  <p className="ad-card-label">{children}</p>
)

type Tone = 'green' | 'orange' | 'red' | 'amber' | 'grey'
/** A pill with an optional coloured dot: "Active", "On route · Trip 1", "Driver". */
export function Pill({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="ad-pill">
      {tone && <i className={`ad-dot ad-dot-${tone}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

type Variant = 'primary' | 'grey' | 'outline' | 'danger'
const classes = (variant: Variant, small?: boolean, extra?: string) =>
  ['ad-btn', `ad-btn-${variant}`, small ? 'ad-btn-small' : '', extra ?? '']
    .filter(Boolean)
    .join(' ')

export function Btn({
  variant = 'primary',
  small,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return <button type="button" className={classes(variant, small, className)} {...props} />
}
export function LinkBtn({
  variant = 'primary',
  small,
  className,
  ...props
}: LinkProps & { variant?: Variant; small?: boolean }) {
  return <Link className={classes(variant, small, className)} {...props} />
}

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <span className="ad-avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {text}
    </span>
  )
}

/** A labelled text field with an optional hint under it. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  )
}

/** A sign-in detail the administrator hands over, with a button to copy it. */
export function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div className="ad-credential">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Btn
        small
        variant="grey"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          const copied = await copyText(value)
          if (copied) toast.success(`${label} copied`)
          else toast.error('Copying is not available here')
        }}
      >
        Copy
      </Btn>
    </div>
  )
}

/** Previous and next buttons with the page number. Renders nothing when everything fits on one page. */
export function Pager({
  paging,
  label,
}: {
  paging: Pick<Paging, 'page' | 'pages' | 'setPage'>
  label: string
}) {
  if (paging.pages <= 1) return null
  return (
    <nav className="ad-pager" aria-label={`${label} pages`}>
      <Btn
        small
        variant="outline"
        disabled={paging.page === 1}
        onClick={() => paging.setPage(paging.page - 1)}
      >
        Previous
      </Btn>
      <span aria-live="polite">
        Page {paging.page} of {paging.pages}
      </span>
      <Btn
        small
        variant="outline"
        disabled={paging.page === paging.pages}
        onClick={() => paging.setPage(paging.page + 1)}
      >
        Next
      </Btn>
    </nav>
  )
}
