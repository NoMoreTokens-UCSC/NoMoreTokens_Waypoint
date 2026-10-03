import { ClipboardList, Link2, Shield, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const route = (path: string, title: string, page: () => Promise<{ default: ComponentType }>) => ({
  path,
  title,
  component: lazyPage(() => page().then((m) => m.default)),
  shell: true,
})

export const administrationModule: RoleModule = {
  key: 'administration',
  label: 'Administration',
  description: 'Manage your team and access.',
  icon: Users,
  basePath: '/administration',
  home: '/administration/team',
  nav: [
    { label: 'Users', menuLabel: 'Team & access', path: '/administration/team', icon: Users },
    { label: 'Roles & access', path: '/administration/roles', icon: Shield },
    { label: 'Assignments', path: '/administration/assignments', icon: Link2 },
    { label: 'Audit log', path: '/administration/audit', icon: ClipboardList },
  ],
  search: {
    placeholder: 'Search users, roles or outlets',
    find: (snapshot, query) => {
      const text = query.toLowerCase()
      return snapshot.members
        .filter((member) =>
          `${member.name} ${member.role} ${member.assignment ?? ''} ${member.mobile ?? ''}`
            .toLowerCase()
            .includes(text),
        )
        .map((member) => ({
          id: member.id,
          text: `${member.name} · ${member.role} · ${member.assignment ?? member.depot ?? ''}`,
          path: `/administration/team/${member.id}`,
        }))
    },
  },
  shell: {
    compactBelow: 900,
    compactNav: 'menu',
    recoveryLink: false,
    identity: () => ({ title: 'Administrator', subtitle: 'Waypoint Group' }),
    compactSubtitle: () => 'Admin',
  },
  routes: [
    route('/administration/team', 'Team & access', () => import('./pages/TeamPage')),
    // Fixed paths first: the user detail route takes any other id.
    route('/administration/team/new', 'Add user', () => import('./pages/AddUserPage')),
    route('/administration/team/created', 'Account created', () => import('./pages/InvitedPage')),
    route('/administration/team/:memberId', 'User', () => import('./pages/UserDetailPage')),
    route('/administration/roles', 'Roles & access', () => import('./pages/RolesPage')),
    route('/administration/assignments', 'Assignments', () => import('./pages/AssignmentsPage')),
    route('/administration/audit', 'Audit log', () => import('./pages/AuditPage')),
  ],
}
