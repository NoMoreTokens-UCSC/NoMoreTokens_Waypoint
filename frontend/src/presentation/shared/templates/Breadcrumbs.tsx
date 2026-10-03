import { createContext, useContext, useEffect } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { appRoutes } from '../../roles/registry'
import { BackIcon } from './shellIcons'

export interface Crumb {
  label: string
  /** Omit on the current page. */
  to?: string
}

export const BreadcrumbContext = createContext<(trail: Crumb[]) => void>(() => {})

/**
 * Replaces the page part of the shell breadcrumb while the calling page is shown, e.g. on a
 * detail page: `useBreadcrumb([{ label: 'Deliveries', to: '/store-manager/deliveries' }, { label: id }])`.
 * Without it the breadcrumb shows the route's `title` from the module definition.
 */
export function useBreadcrumb(trail: Crumb[]) {
  const setTrail = useContext(BreadcrumbContext)
  const key = JSON.stringify(trail)
  useEffect(() => {
    setTrail(JSON.parse(key) as Crumb[])
    return () => setTrail([])
  }, [key, setTrail])
}

/** "< Back | Home / Page" for pages inside the workspace shell. */
export function Breadcrumbs({ home, trail }: { home: string; trail: Crumb[] }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const route = appRoutes.find((candidate) => matchPath(candidate.path, pathname))
  const atHome = pathname === home
  const items: Crumb[] = [
    { label: 'Home', to: home },
    ...(trail.length ? trail : atHome ? [] : [{ label: route?.title ?? 'Page' }]),
  ]
  const back = () => {
    // React Router records the position in its history stack; index 0 means nothing to go back to.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate(home)
  }
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {!atHome && (
        <>
          <button type="button" className="breadcrumb-back" onClick={back}>
            <BackIcon />
            Back
          </button>
          <span className="breadcrumb-divider" aria-hidden="true" />
        </>
      )}
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.to && !last ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
