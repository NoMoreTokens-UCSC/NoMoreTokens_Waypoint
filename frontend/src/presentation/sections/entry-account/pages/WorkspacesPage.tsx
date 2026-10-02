import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { roleModules } from '../../../roles/registry'
import { BackLink, Wordmark, fieldRoles, rolePhotos, roleTitle } from '../components/EntryChrome'

export default function WorkspacesPage() {
  const others = roleModules.filter((role) => !fieldRoles.includes(role))
  return (
    <div className="entry-page entry-workspaces">
      <header className="entry-bar">
        <Wordmark />
        <Link to="/welcome" className="entry-bar-link">
          Welcome
        </Link>
      </header>
      <main className="entry-workspaces-body">
        <BackLink trail={['Workspaces']} />
        <h1>Your workspace.</h1>
        <p className="entry-workspaces-lead">Choose a role to explore the prototype.</p>
        <div className="entry-role-grid">
          {fieldRoles.map((role) => (
            <Link key={role.key} to={role.home} className="entry-role-card">
              <div className="entry-role-text">
                <h2>{roleTitle(role.label)}</h2>
                <p>{role.description}</p>
                <span className="entry-role-open">
                  Open workspace <ArrowRight size={12} />
                </span>
              </div>
              <img src={rolePhotos[role.key]} alt="" />
            </Link>
          ))}
        </div>
        {others.length > 0 && (
          <p className="entry-workspaces-more">
            Also available:{' '}
            {others.map((role) => (
              <Link key={role.key} to={role.home}>
                {role.label}
              </Link>
            ))}
            {' · '}
            <Link to="/recovery">Saved records</Link>
          </p>
        )}
        <p className="entry-workspaces-note">
          Prototype role switcher. Production access follows the signed-in account’s permissions.
        </p>
      </main>
    </div>
  )
}
