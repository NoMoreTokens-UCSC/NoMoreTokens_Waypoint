import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Snapshot, Workspace } from '../../domain/models'

/** One URL owned by a module. `shell` pages render inside the shared workspace layout. */
export interface ModuleRoute {
  path: string
  component: LazyExoticComponent<ComponentType>
  shell: boolean
}
export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}
export interface SearchResult {
  id: string
  text: string
  path: string
}
/** What the shared header search box looks for in a role's workspace. */
export interface HeaderSearch {
  placeholder: string
  find: (snapshot: Snapshot, query: string) => SearchResult[]
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
}
