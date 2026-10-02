import type { ComponentType, LazyExoticComponent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Snapshot, Workspace } from '../../domain/models'
import type { Session } from '../session/useSession'

/** One URL owned by a module. `shell` pages render inside the shared workspace layout. */
export interface ModuleRoute {
  /** May contain parameters, e.g. `/store-manager/deliveries/:orderId`. */
  path: string
  /** Page name shown in the breadcrumb. */
  title: string
  component: LazyExoticComponent<ComponentType>
  shell: boolean
}
export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Draws a custom icon (e.g. from the design) instead of `icon`; `active` marks the current page. */
  renderIcon?: (active: boolean) => ReactNode
  /** Label in the compact navigation menu when it differs from the sidebar label. */
  menuLabel?: string
}
/** How a role's workspace chrome behaves. Everything is optional; defaults suit most roles. */
export interface ShellOptions {
  /** Width below which the sidebar gives way to the compact header. Default 761. */
  compactBelow?: number
  /** Compact navigation: a bottom tab bar ('tabs', default) or only the header menu ('menu'). */
  compactNav?: 'tabs' | 'menu'
  /** Show the Recovery link in the sidebar. Default true. */
  recoveryLink?: boolean
  /** Sidebar footer text. Defaults to the person's name and assignment. */
  identity?: (session: Session) => { title: string; subtitle: string }
  /** Second line of the compact header, e.g. "Store · OUT001". */
  compactSubtitle?: (session: Session) => string
  /** Number shown on the header bell (e.g. unacknowledged alerts). Hidden when 0 or absent. */
  alertCount?: (snapshot: Snapshot, session: Session) => number
}
export interface SearchResult {
  id: string
  text: string
  path: string
}
/** What the shared header search box looks for in a role's workspace. */
export interface HeaderSearch {
  placeholder: string
  find: (snapshot: Snapshot, query: string, session: Session) => SearchResult[]
}
/** A self-contained slice of the app: its owner edits only its own folder and this definition. */
export interface AppModule {
  key: string
  routes: ModuleRoute[]
}
/** A signed-in role workspace: adds the identity and navigation the shared shell renders. */
export interface RoleModule extends AppModule {
  key: Workspace
  label: string
  description: string
  icon: LucideIcon
  basePath: string
  home: string
  nav: NavItem[]
  /** Optional header search; the shell's order and vehicle search is used otherwise. */
  search?: HeaderSearch
  shell?: ShellOptions
}
