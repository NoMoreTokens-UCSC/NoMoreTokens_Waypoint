import { lazyPage } from '../../roles/lazyPage'
import type { AppModule } from '../../roles/types'

const account = () => import('./pages/AccountPages')

/** Public entry pages (welcome, how it works, login, workspace chooser) and account pages. */
export const entryAccountModule: AppModule = {
  key: 'entry-account',
  routes: [
    {
      path: '/welcome',
      title: 'Welcome',
      component: lazyPage(() => import('./pages/HomePage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/how-it-works',
      title: 'How it works',
      component: lazyPage(() => import('./pages/ServicePage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/login',
      title: 'Sign in',
      component: lazyPage(() => import('./pages/LoginPage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/workspaces',
      title: 'Workspaces',
      component: lazyPage(() => import('./pages/WorkspacesPage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/account/profile',
      title: 'Profile',
      component: lazyPage(() => import('../../shared/pages/ProfilePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/account/settings',
      title: 'Preferences',
      component: lazyPage(() => account().then((m) => m.SettingsPage)),
      shell: true,
    },
    {
      path: '/account/notifications',
      title: 'Notifications',
      component: lazyPage(() => account().then((m) => m.NotificationsPage)),
      shell: true,
    },
  ],
}
