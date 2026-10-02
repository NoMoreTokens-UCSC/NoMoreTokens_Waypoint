import { ClipboardList, ShieldCheck, Truck, Users } from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const pages = () => import('./pages/AdminPages')

export const administrationModule: RoleModule = {
  key: 'administration',
  label: 'Administration',
  description: 'Manage your team and access.',
  icon: Users,
  basePath: '/administration',
  home: '/administration/team',
  nav: [
    { label: 'Team & access', path: '/administration/team', icon: Users },
    { label: 'Roles & access', path: '/administration/roles', icon: ShieldCheck },
    { label: 'Assignments', path: '/administration/assignments', icon: Truck },
    { label: 'Audit log', path: '/administration/audit', icon: ClipboardList },
  ],
  routes: [
    {
      path: '/administration/team',
      title: 'Team & access',
      component: lazyPage(() => pages().then((m) => m.TeamPage)),
      shell: true,
    },
    {
      path: '/administration/roles',
      title: 'Roles & access',
      component: lazyPage(() => pages().then((m) => m.RolesPage)),
      shell: true,
    },
    {
      path: '/administration/assignments',
      title: 'Assignments',
      component: lazyPage(() => pages().then((m) => m.AssignmentsPage)),
      shell: true,
    },
    {
      path: '/administration/audit',
      title: 'Audit log',
      component: lazyPage(() => pages().then((m) => m.AuditPage)),
      shell: true,
    },
  ],
}
