import { useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import {
  Package,
  LayoutGrid,
  AlertTriangle,
  Truck,
  MapPin,
  ChartNoAxesCombined,
  Bell,
  Menu,
  Navigation,
  ArrowLeftRight,
  Users,
  ClipboardList,
  Home,
  Settings,
  User,
  LogOut,
  CloudUpload,
  ShieldCheck,
  Camera,
  Inbox,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Workspace } from '../../../domain/models'
import { SearchField, Modal, Notice } from '../molecules/Common'
import { Button } from '../atoms/button'
import { useConnectivity, useOperations } from '../../hooks/useOperations'
import { toast } from 'sonner'

export const workspaces: {
  key: Workspace
  label: string
  description: string
  path: string
  icon: LucideIcon
}[] = [
  {
    key: 'dispatcher',
    label: 'Dispatcher',
    description: 'Plan, allocate and follow progress.',
    path: '/dispatcher/orders',
    icon: LayoutGrid,
  },
  {
    key: 'store-manager',
    label: 'Store Manager',
    description: 'Order, track and confirm receipt.',
    path: '/store-manager/orders',
    icon: Package,
  },
  {
    key: 'loader',
    label: 'Loader',
    description: 'Prepare loads and report shortfalls.',
    path: '/loader/queue',
    icon: ClipboardList,
  },
  {
    key: 'driver',
    label: 'Driver',
    description: 'Deliver, record and sync.',
    path: '/driver/home',
    icon: Truck,
  },
  {
    key: 'administration',
    label: 'Administration',
    description: 'Manage your team and access.',
    path: '/administration/team',
    icon: Users,
  },
]
const nav: Record<Workspace, [string, string, LucideIcon][]> = {
  dispatcher: [
    ['Orders', 'orders', Package],
    ['Planning', 'planning', LayoutGrid],
    ['Deferrals', 'deferrals', AlertTriangle],
    ['Fleet', 'fleet', Truck],
    ['Live tracking', 'tracking', MapPin],
    ['Analytics', 'analytics', ChartNoAxesCombined],
  ],
  'store-manager': [
    ['Overview', 'overview', Home],
    ['Orders', 'orders', Package],
    ['Deliveries', 'deliveries', Truck],
    ['Alerts', 'alerts', Bell],
  ],
  loader: [
    ['Shift dashboard', 'queue', LayoutGrid],
    ['Load workspace', 'loading', ClipboardList],
    ['Loading proof', 'proof', Camera],
  ],
  driver: [
    ['Home', 'home', Home],
    ['Current route', 'route', MapPin],
    ['Delivery proof', 'delivery', Camera],
    ['Issues', 'issues', AlertTriangle],
  ],
  administration: [
    ['Team & access', 'team', Users],
    ['Roles & access', 'roles', ShieldCheck],
    ['Assignments', 'assignments', Truck],
    ['Audit log', 'audit', ClipboardList],
  ],
}
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
export default function WorkspaceLayout() {
  const location = useLocation(),
    { data, isPending, error } = useOperations(),
    online = useConnectivity()
  const [menu, setMenu] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [search, setSearch] = useState('')
  const prefix = location.pathname.split('/')[1]
  const role = (workspaces.find((w) => w.key === prefix)?.key ??
    (prefix === 'recovery' ? 'driver' : 'dispatcher')) as Workspace
  const workspace = workspaces.find((w) => w.key === role)!
  const pendingCount = data?.queue.filter((q) => q.status !== 'accepted').length ?? 0
  const offline = !online || data?.settings.simulatedOffline
  const navigation = (
    <>
      {nav[role].map(([label, path, Icon]) => (
        <NavLink
          key={path}
          to={`/${role}/${path}`}
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
  const results =
    search.trim() && data
      ? [
          ...data.orders
            .filter((o) =>
              `${o.id} ${o.outlet} ${o.outletName}`.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 6)
            .map((o) => ({
              id: o.id,
              text: `${o.id} · ${o.outletName}`,
              path: `/dispatcher/orders?search=${o.id}`,
            })),
          ...data.vehicles
            .filter((v) => `${v.id} ${v.location}`.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 4)
            .map((v) => ({
              id: v.id,
              text: `${v.id} · ${v.location}`,
              path: `/dispatcher/fleet?search=${v.id}`,
            })),
        ]
      : []
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
            <span className="avatar avatar-orange">WG</span>
            <div>
              <strong className="text-xs">Waypoint Group</strong>
              <p className="text-[10px] text-muted-foreground mt-1">Peliyagoda operations</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start text-xs"
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
              placeholder="Search orders, outlets or vehicles"
              label="Search the workspace"
            />
          </div>
          <span className="mobile-menu font-semibold text-lg">waypoint</span>
          <div className="topbar-right">
            {data?.settings.notifications && (
              <Link className="icon-button" to="/account/notifications" aria-label="Notifications">
                <Bell size={19} />
              </Link>
            )}
            <Link to="/account/profile" className="avatar" aria-label="Your profile">
              SB
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
              <p className="p-3 text-sm">No matching orders or vehicles.</p>
            )}
          </div>
        )}
        <main className="main-content" id="main-content">
          <div className="breadcrumbs">
            <Link to="/welcome">
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
        {nav[role].slice(0, 4).map(([label, path, Icon]) => (
          <NavLink key={path} to={`/${role}/${path}`}>
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
        {workspaces.map((w) => (
          <Link
            key={w.key}
            to={w.path}
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
