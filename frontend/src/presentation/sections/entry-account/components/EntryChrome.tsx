import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Workspace } from '../../../../domain/models'
import { roleModules } from '../../../roles/registry'
import '../entry.css'

/** Role photos for the entry pages, keyed by workspace. */
export const rolePhotos: Partial<Record<Workspace, string>> = {
  dispatcher: '/images/entry/role-dispatcher.jpg',
  'store-manager': '/images/entry/role-store-manager.jpg',
  loader: '/images/entry/role-loader.jpg',
  driver: '/images/entry/role-driver.jpg',
}
/** The four field roles the entry pages present (administration is listed separately). */
export const fieldRoles = (['dispatcher', 'loader', 'driver', 'store-manager'] as const).map(
  (key) => roleModules.find((module) => module.key === key)!,
)

/** Entry pages use sentence case ("Store manager") where the shell uses title case. */
export const roleTitle = (label: string) => label[0] + label.slice(1).toLowerCase()

export function Wordmark({ to = '/welcome' }: { to?: string }) {
  return (
    <Link to={to} className="entry-wordmark" aria-label="Waypoint home">
      waypoint
      <span aria-hidden="true" />
    </Link>
  )
}

export function BackLink({ trail }: { trail: string[] }) {
  const navigate = useNavigate()
  return (
    <nav className="entry-back" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/welcome'))}
      >
        <ChevronLeft size={16} />
        Back
      </button>
      <span className="entry-back-divider" aria-hidden="true" />
      <Link to="/welcome">Home</Link>
      {trail.map((item) => (
        <span key={item} className="entry-back-current">
          / {item}
        </span>
      ))}
    </nav>
  )
}

export function EntryFooter() {
  return (
    <footer className="entry-footer">
      <div className="entry-footer-top">
        <div>
          <Link to="/welcome" className="entry-footer-brand">
            waypoint
          </Link>
          <p>Every delivery. A clearer day.</p>
        </div>
        <div className="entry-footer-columns">
          <div>
            <h2>Product</h2>
            {fieldRoles.map((role) => (
              <Link key={role.key} to={role.home}>
                {roleTitle(role.label)}
              </Link>
            ))}
          </div>
          <div>
            <h2>Company</h2>
            <span>About Waypoint</span>
            <span>Careers</span>
            <span>Contact</span>
          </div>
          <div>
            <h2>Support</h2>
            <span>Help center</span>
            <span>Status</span>
            <span>support@waypointgroup.lk</span>
          </div>
        </div>
      </div>
      <div className="entry-footer-bottom">
        <p>
          © 2026 Waypoint Group <span>Privacy</span> <span>Terms</span>
        </p>
        <span className="entry-status">
          <span aria-hidden="true" />
          All systems normal
        </span>
      </div>
    </footer>
  )
}
