import { lazyPage } from '../../roles/lazyPage'
import type { AppModule } from '../../roles/types'

const recovery = lazyPage(() => import('./pages/RecoveryPage').then((m) => m.default))

/** Saved-record review and sync, reachable from every workspace. */
export const recoveryModule: AppModule = {
  key: 'recovery',
  routes: [
    { path: '/recovery', title: 'Saved records', component: recovery, shell: true },
    { path: '/recovery/review', title: 'Review updated route', component: recovery, shell: true },
  ],
}
