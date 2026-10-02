import { lazyPage } from '../../roles/lazyPage'
import type { AppModule } from '../../roles/types'

const account = () => import('./pages/AccountPages')

/** Public entry pages (welcome, how it works, login, workspace chooser) and account pages. */
export const entryAccountModule: AppModule = {
  key: 'entry-account',
  routes: [
    {
      path: '/welcome',
      component: lazyPage(() => import('./pages/HomePage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/how-it-works',
      component: lazyPage(() => import('./pages/ServicePage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/login',
      component: lazyPage(() => import('./pages/LoginPage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/workspaces',
      component: lazyPage(() => import('./pages/WorkspacesPage').then((m) => m.default)),
      shell: false,
    },
    {
      path: '/account/profile',
      component: lazyPage(() => account().then((m) => m.ProfilePage)),
      shell: true,
    },
    {
      path: '/account/settings',
      component: lazyPage(() => account().then((m) => m.SettingsPage)),
      shell: true,
    },
    {
      path: '/account/notifications',
      component: lazyPage(() => account().then((m) => m.NotificationsPage)),
      shell: true,
    },
  ],
}
