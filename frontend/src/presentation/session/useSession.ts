import { useLocation } from 'react-router-dom'
import { profileOf } from '../../domain/outlets'
import type { Snapshot, TeamMember, Workspace } from '../../domain/models'
import { useOperations } from '../hooks/useOperations'
import { roleModules } from '../roles/registry'
import { getUser } from '../../infrastructure/http/apiClient'

export interface Session {
  role: Workspace
  memberId?: string
  /** The sign-in name, for a real account. */
  username?: string
  name: string
  initials: string
  depot?: string
  /** What this person works on: outlet for store managers, vehicle for drivers. */
  outletId?: string
  vehicleId?: string
  assignment?: string
}

const lastRoleKey = 'waypoint.lastRole'
function rememberRole(role: Workspace) {
  try {
    localStorage.setItem(lastRoleKey, role)
  } catch {
    // Storage can be unavailable (private mode); the default role is used instead.
  }
}
function recalledRole(): Workspace | undefined {
  try {
    const value = localStorage.getItem(lastRoleKey)
    return roleModules.find((module) => module.key === value)?.key
  } catch {
    return undefined
  }
}

/** The role whose workspace is open. Shared pages (account, recovery) keep the last role. */
export function useActiveRole(): Workspace {
  const prefix = `/${useLocation().pathname.split('/')[1]}`
  const fromPath = roleModules.find((module) => module.basePath === prefix)?.key
  if (fromPath) {
    rememberRole(fromPath)
    return fromPath
  }
  return recalledRole() ?? (prefix === '/recovery' ? 'driver' : 'dispatcher')
}

function memberFor(snapshot: Snapshot | undefined, role: Workspace): TeamMember | undefined {
  const members = snapshot?.members ?? []
  if (role === 'driver')
    return members.find((member) => member.id === (snapshot?.activeDriverId ?? 'USR001'))
  return (
    members.find((member) => member.role === role && member.status === 'Active') ??
    members.find((member) => member.role === role)
  )
}
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

const ROLE_KEY_MAP: Record<string, Workspace> = {
  DISPATCHER: 'dispatcher',
  LOADER: 'loader',
  DRIVER: 'driver',
  STORE_MANAGER: 'store-manager',
  ADMIN: 'administration',
}

/**
 * Who is using the app. Reads identity from real sign-in (getUser) when available,
 * and falls back to the demo seeded team when running offline.
 */
export function useSession(): Session {
  const activeRole = useActiveRole()
  const user = getUser()
  const { data } = useOperations()
  const member = memberFor(data, activeRole)

  if (user) {
    const mappedRole = ROLE_KEY_MAP[user.role] ?? activeRole
    const name = user.full_name || user.username
    const depot = user.depot_id ?? member?.depot ?? 'Peliyagoda'
    const outletId = user.outlet_id ?? member?.outletId
    const vehicleId = user.vehicle_id ?? member?.vehicleId
    return {
      role: mappedRole,
      memberId: String(user.id),
      username: user.username,
      name,
      initials: initialsOf(name),
      depot,
      outletId,
      vehicleId,
      assignment: outletId ? `${outletId}` : vehicleId ? `${vehicleId}` : member?.assignment,
    }
  }

  // Demo: the store workspace can be opened as another outlet (a different brand).
  const outlet = activeRole === 'store-manager' ? profileOf(data?.activeOutletId ?? '') : undefined
  const label = roleModules.find((module) => module.key === activeRole)?.label ?? 'User'
  const name = member?.name ?? label
  return {
    role: activeRole,
    memberId: member?.id,
    name,
    initials: initialsOf(name),
    depot: member?.depot,
    outletId: outlet?.id ?? member?.outletId,
    vehicleId: member?.vehicleId,
    assignment: outlet ? `${outlet.id} · ${outlet.brand}` : member?.assignment,
  }
}
