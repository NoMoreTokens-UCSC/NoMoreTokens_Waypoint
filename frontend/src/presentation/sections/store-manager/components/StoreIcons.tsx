import { AlertTriangle, Check, Package } from 'lucide-react'

/** Sidebar icons drawn after the design: filled when idle, orange when the page is open. */
const paint = (active: boolean) =>
  active ? { fill: '#F26A2E', stroke: '#F26A2E' } : { fill: '#3D424A', stroke: '#6E737B' }
const stroke = {
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function GridIcon({ active }: { active: boolean }) {
  const p = paint(active)
  const squares = [
    'M7.5 3.33H4.17a.83.83 0 0 0-.84.84V7.5c0 .46.38.83.84.83H7.5c.46 0 .83-.37.83-.83V4.17a.83.83 0 0 0-.83-.84Z',
    'M15.83 3.33H12.5a.83.83 0 0 0-.83.84V7.5c0 .46.37.83.83.83h3.33c.46 0 .84-.37.84-.83V4.17a.83.83 0 0 0-.84-.84Z',
    'M7.5 11.67H4.17a.83.83 0 0 0-.84.83v3.33c0 .46.38.84.84.84H7.5c.46 0 .83-.38.83-.84V12.5a.83.83 0 0 0-.83-.83Z',
    'M15.83 11.67H12.5a.83.83 0 0 0-.83.83v3.33c0 .46.37.84.83.84h3.33c.46 0 .84-.38.84-.84V12.5a.83.83 0 0 0-.84-.83Z',
  ]
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {squares.map((d) => (
        <path key={d} d={d} fill={p.fill} stroke={p.stroke} {...stroke} />
      ))}
    </svg>
  )
}

export function BoxIcon({ active }: { active: boolean }) {
  const p = paint(active)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5 17.5 6.67v7.5L10 18.33 2.5 14.17v-7.5l3.75-2.08L10 2.5Z" fill={p.fill} />
      <path
        d="M2.5 6.67v7.5L10 18.33l7.5-4.16v-7.5L10 2.5 2.5 6.67ZM17.5 6.67 10 10.83M10 18.33v-7.5M2.5 6.67 10 10.83M6.25 4.58l7.5 4.17"
        stroke={p.stroke}
        {...stroke}
      />
    </svg>
  )
}

export function TruckIcon({ active }: { active: boolean }) {
  const p = paint(active)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 5h9.17v3.33H15l2.5 3.34v2.5H2.5V5Z"
        fill={p.fill}
        stroke={p.stroke}
        {...stroke}
      />
      <circle cx="5.83" cy="15" r="1.67" fill={p.fill} stroke={p.stroke} {...stroke} />
      <circle cx="15" cy="15" r="1.67" fill={p.fill} stroke={p.stroke} {...stroke} />
    </svg>
  )
}

export function BellFilledIcon({ active }: { active: boolean }) {
  const p = paint(active)
  return (
    <svg width="20" height="20" viewBox="14 13 16 18" fill="none" aria-hidden="true">
      <path
        d="M20.33 29.5h3.34M16.17 26.17h11.66l-1.66-2.5V19.5a4.17 4.17 0 0 0-8.34 0v4.17l-1.66 2.5Z"
        fill={p.fill}
        stroke={p.stroke}
        {...stroke}
      />
    </svg>
  )
}

/** The green parcel mark beside "Fresh · Chilled" and "Fresh · Dry". */
export function ParcelIcon({ size = 20 }: { size?: number }) {
  return <Package size={size} color="#1E8A57" strokeWidth={1.5} aria-hidden="true" />
}
export function AlertIcon({ tone = 'warning' }: { tone?: 'warning' | 'danger' }) {
  return (
    <AlertTriangle
      size={20}
      color={tone === 'danger' ? '#C63A2F' : '#C2501D'}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  )
}
export function CheckIcon() {
  return <Check size={20} color="#1E8A57" strokeWidth={2} aria-hidden="true" />
}
