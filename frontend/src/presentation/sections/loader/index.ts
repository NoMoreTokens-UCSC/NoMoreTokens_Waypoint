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
    {
      label: 'Load workspace',
      path: '/loader/loading',
      icon: ClipboardList,
      activePaths: ['/loader/loading'],
      availability: (snapshot, session) => {
        const match = typeof window !== 'undefined' ? window.location.pathname.match(/\/loader\/(?:loading|proof)\/([^/?#]+)/) : null
        const currentId = match ? match[1] : null
        if (currentId) return { path: `/loader/loading/${currentId}` }
        const loads = snapshot.loads.filter((l) => !session.depot || l.depot === session.depot)
        const active = loads.find((l) => !l.completed && !l.released) ?? loads[0]
        return active
          ? { path: `/loader/loading/${active.id}` }
          : { disabledReason: 'Select a load from the shift dashboard to begin.' }
      },
    },
    {
      label: 'Loading proof',
      path: '/loader/proof',
      icon: Camera,
      activePaths: ['/loader/proof'],
      availability: (snapshot, session) => {
        const match = typeof window !== 'undefined' ? window.location.pathname.match(/\/loader\/(?:loading|proof)\/([^/?#]+)/) : null
        const currentId = match ? match[1] : null
        if (currentId) return { path: `/loader/proof/${currentId}` }
        const loads = snapshot.loads.filter((l) => !session.depot || l.depot === session.depot)
        const active =
          loads.find((l) => !l.released && (l.completed || l.items.some((i) => i.loaded > 0))) ??
          loads[0]
        return active
          ? { path: `/loader/proof/${active.id}` }
          : { disabledReason: 'Loading proof becomes available once loading has started.' }
      },
    },
  ],
  routes: [
    {
      path: '/loader/queue',
      title: 'Shift dashboard',
      component: lazyPage(() => pages().then((m) => m.LoaderQueuePage)),
      shell: true,
    },
    {
      path: '/loader/loading',
      title: 'Load workspace',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage)),
      shell: true,
    },
    {
      path: '/loader/proof',
      title: 'Loading proof',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage), { proofOnly: true }),
      shell: true,
    },
    {
      path: '/loader/loading/:loadId',
      title: 'Load workspace',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage)),
      shell: true,
    },
    {
      path: '/loader/proof/:loadId',
      title: 'Loading proof',
      component: lazyPage(() => pages().then((m) => m.LoaderWorkspacePage), { proofOnly: true }),
      shell: true,
    },
  ],
}
