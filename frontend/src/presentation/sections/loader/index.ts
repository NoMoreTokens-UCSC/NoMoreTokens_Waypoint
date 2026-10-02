import { Camera, ClipboardList, LayoutGrid } from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const pages = () => import('./pages/LoaderPages')

export const loaderModule: RoleModule = {
  key: 'loader',
  label: 'Loader',
  description: 'Prepare loads and report shortfalls.',
  icon: ClipboardList,
  basePath: '/loader',
  home: '/loader/queue',
  nav: [
    { label: 'Shift dashboard', path: '/loader/queue', icon: LayoutGrid },
    { label: 'Load workspace', path: '/loader/loading', icon: ClipboardList },
    { label: 'Loading proof', path: '/loader/proof', icon: Camera },
  ],
  routes: [
    {
      path: '/loader/queue',
      component: lazyPage(() => pages().then((m) => m.LoaderQueuePage)),
      shell: true,
    },
    {
      path: '/loader/loading',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage)),
      shell: true,
    },
    {
      path: '/loader/proof',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage), { proofOnly: true }),
      shell: true,
    },
  ],
}
