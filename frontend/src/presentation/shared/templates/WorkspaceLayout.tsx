import { useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import {
  Bell,
  Menu,
  Navigation,
  ArrowLeftRight,
  Home,
  Settings,
  User,
  LogOut,
  CloudUpload,
  Inbox,
} from 'lucide-react'
import { SearchField, Modal, Notice } from '../molecules/Common'
import { Button } from '../atoms/button'
import { useConnectivity, useOperations } from '../../hooks/useOperations'
import { roleModules } from '../../roles/registry'
import { useSession } from '../../session/useSession'
import { workspaceSearch } from './workspaceSearch'
import { toast } from 'sonner'

export function Brand() {
  return (
    <div className="wordmark">
      <span className="brand-mark">
        <Navigation size={20} fill="currentColor" strokeWidth={1.5} />
      </span>
      waypoint
    </div>
  )
}
/** Shared chrome for every role: sidebar, header and mobile navigation come from the role's module. */
export default function WorkspaceLayout() {
  const location = useLocation(),
    { data, isPending, error } = useOperations(),
    online = useConnectivity(),
    session = useSession()
  const [menu, setMenu] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [search, setSearch] = useState('')
  const prefix = location.pathname.split('/')[1]
  const workspace = roleModules.find((module) => module.key === session.role)!
  const headerSearch = workspace.search ?? workspaceSearch
  const pendingCount = data?.queue.filter((q) => q.status !== 'accepted').length ?? 0
  const offline = !online || data?.settings.simulatedOffline
  const context = session.assignment ?? session.depot ?? 'Waypoint Group'
  const navigation = (
    <>
      {workspace.nav.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={() => setMenu(false)}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
      <div className="border-t mt-5 pt-3">
        <NavLink
          to="/recovery"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={() => setMenu(false)}
        >
          <CloudUpload />
          Recovery
          {pendingCount > 0 && <span className="ml-auto text-xs text-primary">{pendingCount}</span>}
        </NavLink>
      </div>
    </>
  )
  const logout = () => {
    if (pendingCount) toast.error('Sync your saved records before leaving this workspace.')
    else window.location.assign('/welcome')
  }
  const results = search.trim() && data ? headerSearch.find(data, search.trim()) : []
  return (
    <div className="app-shell">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-white p-3"
        href="#main-content"
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/welcome" aria-label="Waypoint home">
          <Brand />
        </Link>
        <div className="workspace-label">{workspace.label.toUpperCase()}</div>
        <nav aria-label="Workspace navigation">{navigation}</nav>
        <div className="sidebar-footer">
          <div className="sidebar-identity">
            <span className="avatar avatar-orange">{session.initials}</span>
            <div className="min-w-0">
              <strong className="text-xs block truncate">{session.name}</strong>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{context}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full switch-workspace"
            onClick={() => setSwitcher(true)}
          >
            <ArrowLeftRight size={15} />
            Switch workspace
          </Button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div className="global-search">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={headerSearch.placeholder}
              label="Search the workspace"
            />
          </div>
          <div className="mobile-menu mobile-title">
            <span className="font-semibold text-lg">waypoint</span>
            <small>
              {workspace.label} · {session.outletId ?? session.vehicleId ?? session.depot}
            </small>
          </div>
          <div className="topbar-right">
            {data?.settings.notifications && (
              <Link className="icon-button" to="/account/notifications" aria-label="Notifications">
                <Bell size={19} />
              </Link>
            )}
            <Link to="/account/profile" className="avatar" aria-label="Your profile">
              {session.initials}
            </Link>
          </div>
        </header>
        {search.trim() && (
          <div className="absolute left-[240px] top-16 bg-white rounded-lg border shadow-lg z-50 w-[400px] p-2 hidden md:block">
            <p className="text-xs text-muted-foreground px-3 py-2">Workspace results</p>
            {results.length ? (
              results.map((r) => (
                <Link
                  key={r.id}
                  to={r.path}
                  className="block rounded px-3 py-3 text-sm hover:bg-muted"
                  onClick={() => setSearch('')}
                >
                  {r.text}
                </Link>
              ))
            ) : (
              <p className="p-3 text-sm">No matching records.</p>
            )}
          </div>
        )}
        <main className="main-content" id="main-content">
          <div className="breadcrumbs">
            <Link to={workspace.home} aria-label={`${workspace.label} home`}>
              <Home size={13} />
            </Link>
            <span>/</span>
            <span>
              {prefix === 'account'
                ? 'Account'
                : prefix === 'recovery'
                  ? 'Recovery'
                  : workspace.label}
            </span>
            <span>/</span>
            <span className="capitalize">
              {location.pathname.split('/')[2]?.replaceAll('-', ' ') ?? 'Workspace'}
            </span>
          </div>
          {offline && (
            <Notice title="Offline · your work is saved on this device">
              {pendingCount} record{pendingCount === 1 ? '' : 's'} waiting.{' '}
              <Link to="/recovery" className="underline">
                Open recovery
              </Link>
            </Notice>
          )}
          {isPending ? (
            <div className="animate-pulse space-y-5">
              <div className="h-9 w-64 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-80 bg-muted rounded" />
            </div>
          ) : error ? (
            <Notice title="Workspace could not be opened" tone="danger">
              {error.message} · Check that browser storage is available, then reload.
            </Notice>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Compact workspace navigation">
        {workspace.nav.slice(0, 4).map(({ label, path, icon: Icon }) => (
          <NavLink key={path} to={path}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => setSwitcher(true)}
          className="flex flex-col items-center gap-1 p-1 text-[9px] text-muted-foreground"
        >
          <ArrowLeftRight size={20} />
          Workspace
        </button>
      </nav>
      <Modal
        title={workspace.label}
        description="Open a screen in this workspace."
        open={menu}
        onOpenChange={setMenu}
      >
        <nav>{navigation}</nav>
        <Button
          variant="outline"
          onClick={() => {
            setMenu(false)
            setSwitcher(true)
          }}
        >
          <ArrowLeftRight size={16} />
          Switch workspace
        </Button>
        <Link to="/account/profile" onClick={() => setMenu(false)} className="nav-item">
          <User size={18} />
          Profile
        </Link>
        <Link to="/account/settings" onClick={() => setMenu(false)} className="nav-item">
          <Settings size={18} />
          Settings
        </Link>
      </Modal>
      <Modal
        title="Choose your workspace"
        description="Role switching is available for this frontend demo. It is not production authentication."
        open={switcher}
        onOpenChange={setSwitcher}
      >
        {roleModules.map((w) => (
          <Link
            key={w.key}
            to={w.home}
            onClick={() => setSwitcher(false)}
            className="flex gap-3 items-center py-3 border-b"
          >
            <w.icon size={20} className="text-primary" />
            <div>
              <strong className="text-sm">{w.label}</strong>
              <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
            </div>
          </Link>
        ))}
        <Link to="/account/settings" className="nav-item" onClick={() => setSwitcher(false)}>
          <Settings size={16} />
          Preferences
        </Link>
        <button className="nav-item" onClick={logout}>
          <LogOut size={16} />
          Leave demo workspace
        </button>
        <Link to="/recovery" onClick={() => setSwitcher(false)} className="nav-item">
          <Inbox size={16} />
          Saved records
        </Link>
      </Modal>
    </div>
  )
}
