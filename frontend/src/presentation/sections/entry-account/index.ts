import { lazyPage } from '../../roles/lazyPage'
import type { AppModule } from '../../roles/types'

const pages = () => import('./pages/AccountPages')
const welcome = lazyPage(() => pages().then((m) => m.WelcomePage))

/** Entry (role choice) and the signed-in account pages shared by every role. */
export const entryAccountModule: AppModule = {
  key: 'entry-account',
  routes: [
    { path: '/welcome', component: welcome, shell: false },
    // The welcome page is the demo's workspace chooser until real sign-in exists.
    { path: '/workspaces', component: welcome, shell: false },
    {
      path: '/account/profile',
      component: lazyPage(() => pages().then((m) => m.ProfilePage)),
      shell: true,
    },
    {
      path: '/account/settings',
      component: lazyPage(() => pages().then((m) => m.SettingsPage)),
      shell: true,
    },
    {
      path: '/account/notifications',
      component: lazyPage(() => pages().then((m) => m.NotificationsPage)),
      shell: true,
    },
  ],
}

/** Paths that have no page yet; they redirect so old links keep working. */
export const entryRedirects: Record<string, string> = {
  '/login': '/welcome',
  '/how-it-works': '/welcome',
}
