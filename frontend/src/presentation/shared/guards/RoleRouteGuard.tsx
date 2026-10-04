import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Workspace } from '../../../domain/models'
import { getUser } from '../../../infrastructure/http/apiClient'

export const ROLE_HOME_MAP: Record<string, string> = {
  DISPATCHER: '/dispatcher/orders',
  LOADER: '/loader/queue',
  DRIVER: '/driver/home',
  STORE_MANAGER: '/store-manager/overview',
  ADMIN: '/administration/team',
}

export const ROLE_ALLOWED_WORKSPACES: Record<string, Workspace[]> = {
  DISPATCHER: ['dispatcher'],
  LOADER: ['loader'],
  DRIVER: ['driver'],
  STORE_MANAGER: ['store-manager'],
  ADMIN: ['administration', 'dispatcher'],
}

const IS_REAL_BACKEND =
  !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''

interface RoleRouteGuardProps {
  allowedRole: Workspace
  children: ReactNode
}

export function RoleRouteGuard({ allowedRole, children }: RoleRouteGuardProps) {
  const user = getUser()

  // When running against a real backend, unauthenticated users must sign in
  if (!user) {
    if (IS_REAL_BACKEND) {
      return <Navigate to="/login" replace />
    }
    // In offline / prototype demo exploration (unauthenticated), allow all workspaces
    return <>{children}</>
  }

  const roleUpper = (user.role || '').toUpperCase()
  const allowedWorkspaces = ROLE_ALLOWED_WORKSPACES[roleUpper] ?? []
  const isAllowed = allowedWorkspaces.includes(allowedRole)

  // Another role's workspace is not open to this account: send them to the sign-in page.
  if (!isAllowed) return <Navigate to="/login" replace />

  return <>{children}</>
}
