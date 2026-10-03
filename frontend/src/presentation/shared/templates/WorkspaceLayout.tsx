import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import { ArrowLeftRight, CloudUpload, LogOut, Menu, Settings, User } from 'lucide-react'
import { SearchField, Modal, Notice } from '../molecules/Common'
import { Button } from '../atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../atoms/dialog'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useConnectivity, useOperations } from '../../hooks/useOperations'
import { useApiQuery } from '../../hooks/useApiQuery'
import { roleModules } from '../../roles/registry'
import { useSession } from '../../session/useSession'
import { workspaceSearch } from './workspaceSearch'
import { BreadcrumbContext, Breadcrumbs, type Crumb } from './Breadcrumbs'
import { BackIcon, BellIcon, BrandMark, ProfileIcon } from './shellIcons'
import { toast } from 'sonner'

export function Brand() {
  return (
    <div className="wordmark">
      <BrandMark />
      waypoint
    </div>
  )
}
/** Shared chrome for every role: sidebar, header and navigation come from the role's module. */
export default function WorkspaceLayout() {
  const { data, isPending, error } = useOperations(),
    online = useConnectivity(),
    session = useSession(),
    navigate = useNavigate()
  const [menu, setMenu] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false),
    [search, setSearch] = useState(''),
    [trail, setTrail] = useState<Crumb[]>([])
  const workspace = roleModules.find((module) => module.key === session.role)!
  const drafts = useApiQuery(['driver', 'drafts'], (apis) => apis.delivery.listProofDrafts())
  const options = workspace.shell ?? {}
  const compactNav = options.compactNav ?? 'tabs'
  const compact = useMediaQuery(`(max-width: ${(options.compactBelow ?? 761) - 1}px)`)
  const headerSearch = workspace.search ?? workspaceSearch
  const pendingCount =
    (data?.queue.filter((q) => !['accepted', 'superseded'].includes(q.status)).length ?? 0) +
    (session.role === 'driver'
      ? (drafts.data?.filter(
          (draft) =>
            !data?.queue.some(
              (record) =>
                record.stopId === draft.stopId &&
                !['accepted', 'superseded'].includes(record.status),
            ),
        ).length ?? 0)
      : 0)
  const offline = !online || data?.settings.simulatedOffline
  const identity = options.identity?.(session) ?? {
    title: session.name,
    subtitle: session.assignment ?? session.depot ?? 'Waypoint Group',
  }
  const alertCount = data ? (options.alertCount?.(data, session) ?? 0) : 0
  const logout = () => {
    setConfirmLogout(false)
    if (pendingCount) toast.error('Sync your saved records before leaving this workspace.')
    else window.location.assign('/login')
  }
  const results = search.trim() && data ? headerSearch.find(data, search.trim(), session) : []
  const bell = (
    <Link
      className="header-button"
      to={options.accountPaths?.notifications ?? '/account/notifications'}
      aria-label={alertCount ? `Notifications, ${alertCount} new` : 'Notifications'}
    >
      <BellIcon />
      {alertCount > 0 && <span className="header-badge">{alertCount}</span>}
    </Link>
  )
  return (
    <div
      className="app-shell"
      data-role={session.role}
      data-compact={compact}
      data-compact-nav={compactNav}
    >
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
        <div className="workspace-label">{workspace.label}</div>
        <nav aria-label="Workspace navigation">
          {workspace.nav.map(({ label, path, icon: Icon, renderIcon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  {renderIcon ? renderIcon(isActive) : <Icon />}
                  {label}
                </>
              )}
            </NavLink>
          ))}
          {options.recoveryLink !== false && (
            <div className="border-t mt-5 pt-3">
              <NavLink
                to="/recovery"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <CloudUpload />
                Recovery
                {pendingCount > 0 && (
                  <span className="ml-auto text-xs text-primary">{pendingCount}</span>
                )}
              </NavLink>
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-identity">
            <strong>{identity.title}</strong>
            <p>{identity.subtitle}</p>
          </div>
          <Link to="/workspaces" className="switch-workspace">
            Switch workspace
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          {compact ? (
            <>
              <Link to="/welcome" className="compact-brand" aria-label="Waypoint home">
                <strong>waypoint</strong>
                <small>
                  {options.compactSubtitle?.(session) ??
                    `${workspace.label} · ${session.outletId ?? session.vehicleId ?? session.depot ?? ''}`}
                </small>
              </Link>
              <div className="topbar-right">
                {bell}
                <button
                  type="button"
                  className="header-button menu-button"
                  aria-label="Open navigation"
                  onClick={() => setMenu(true)}
                >
                  <Menu size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="global-search">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder={headerSearch.placeholder}
                  label="Search the workspace"
                />
              </div>
              <div className="topbar-right">
                {bell}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger className="header-button" aria-label="Your account">
                    <ProfileIcon />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="account-menu" align="end" sideOffset={8}>
                      <div className="account-menu-identity">
                        <strong>{session.name}</strong>
                        <span>Waypoint Group</span>
                      </div>
                      <DropdownMenu.Item
                        className="account-menu-item"
                        onSelect={() =>
                          navigate(options.accountPaths?.profile ?? '/account/profile')
                        }
                      >
                        <User size={20} />
                        Profile
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="account-menu-item"
                        onSelect={() =>
                          navigate(options.accountPaths?.settings ?? '/account/settings')
                        }
                      >
                        <Settings size={20} />
                        Settings
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="account-menu-item"
                        onSelect={() => setConfirmLogout(true)}
                      >
                        <LogOut size={20} />
                        Log Out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </>
          )}
        </header>
        {!compact && search.trim() && (
          <div className="absolute left-[240px] top-16 bg-white rounded-lg border shadow-lg z-50 w-[400px] p-2">
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
          <Breadcrumbs home={workspace.home} trail={trail} />
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
            <BreadcrumbContext.Provider value={setTrail}>
              <Outlet />
            </BreadcrumbContext.Provider>
          )}
        </main>
      </div>
      {compactNav === 'tabs' && (
        <nav className="mobile-bottom-nav" aria-label="Compact workspace navigation">
          {workspace.nav.slice(0, 4).map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
          <Link
            to="/workspaces"
            className="flex flex-col items-center gap-1 p-1 text-[9px] text-muted-foreground"
          >
            <ArrowLeftRight size={20} />
            Workspace
          </Link>
        </nav>
      )}
      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent
          showCloseButton={false}
          className="compact-menu !top-[88px] !left-4 !translate-x-0 !translate-y-0 !gap-2 !border-0 !p-5 max-[760px]:!top-[72px] min-[761px]:!left-auto min-[761px]:!right-4 min-[761px]:!max-w-[420px]"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Open a screen in this workspace.
          </DialogDescription>
          <nav className="breadcrumbs !mb-0" aria-label="Menu breadcrumb">
            <button type="button" className="breadcrumb-back" onClick={() => setMenu(false)}>
              <BackIcon />
              Back
            </button>
            <span className="breadcrumb-divider" aria-hidden="true" />
            <ol>
              <li>
                <Link to={workspace.home} onClick={() => setMenu(false)}>
                  Home
                </Link>
              </li>
              <li>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Navigation</span>
              </li>
            </ol>
          </nav>
          <p className="compact-menu-title">
            {identity.title} · {workspace.label.charAt(0) + workspace.label.slice(1).toLowerCase()}
          </p>
          {workspace.nav.map(({ label, menuLabel, path }) => (
            <NavLink key={path} to={path} className="menu-item" onClick={() => setMenu(false)} end>
              {menuLabel ?? label}
            </NavLink>
          ))}
          <p className="compact-menu-group">Account</p>
          <Link
            to={options.accountPaths?.profile ?? '/account/profile'}
            className="menu-item"
            onClick={() => setMenu(false)}
          >
            Profile
          </Link>
          <Link
            to={options.accountPaths?.settings ?? '/account/settings'}
            className="menu-item"
            onClick={() => setMenu(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setMenu(false)
              setConfirmLogout(true)
            }}
          >
            Log Out
          </button>
        </DialogContent>
      </Dialog>
      <Modal
        title={
          session.role === 'driver' && pendingCount
            ? 'Saved records need attention'
            : 'Log out of Waypoint?'
        }
        description={
          session.role === 'driver' && pendingCount
            ? `${pendingCount} local record(s) still need submission or sync. Keep this workspace open until they are accepted.`
            : 'You can sign in again to continue in your workspace.'
        }
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
      >
        <div className="flex gap-3">
          {session.role === 'driver' && pendingCount ? (
            <Button
              onClick={() => {
                setConfirmLogout(false)
                navigate('/driver/sync')
              }}
            >
              Open saved records
            </Button>
          ) : (
            <Button onClick={logout}>Log Out</Button>
          )}
          <Button variant="outline" onClick={() => setConfirmLogout(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}
