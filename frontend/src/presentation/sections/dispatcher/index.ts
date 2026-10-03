import {
  AlertTriangle,
  ChartNoAxesCombined,
  LayoutGrid,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const planning = () => import('./pages/PlanningPages')
const fleet = () => import('./pages/FleetPages')

export const dispatcherModule: RoleModule = {
  key: 'dispatcher',
  label: 'Dispatcher',
  description: 'Plan, allocate and follow progress.',
  icon: LayoutGrid,
  basePath: '/dispatcher',
  home: '/dispatcher/orders',
  nav: [
    { label: 'Orders', path: '/dispatcher/orders', icon: Package },
    { label: 'Planning', path: '/dispatcher/planning', icon: LayoutGrid },
    { label: 'Deferrals', path: '/dispatcher/deferrals', icon: AlertTriangle },
    { label: 'Fleet', path: '/dispatcher/fleet', icon: Truck },
    { label: 'Live tracking', path: '/dispatcher/tracking', icon: MapPin },
    { label: 'Analytics', path: '/dispatcher/analytics', icon: ChartNoAxesCombined },
  ],
  routes: [
    {
      path: '/dispatcher/orders',
      title: 'Orders',
      component: lazyPage(() => import('./pages/OrderQueuePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/dispatcher/planning',
      title: 'Planning',
      component: lazyPage(() => planning().then((m) => m.AllocationPage)),
      shell: true,
    },
    {
      path: '/dispatcher/deferrals',
      title: 'Deferrals',
      component: lazyPage(() => planning().then((m) => m.DeferralsPage)),
      shell: true,
    },
    {
      path: '/dispatcher/review',
      title: 'Review',
      component: lazyPage(() => planning().then((m) => m.ReviewPage)),
      shell: true,
    },
    {
      path: '/dispatcher/release',
      title: 'Release',
      component: lazyPage(() => planning().then((m) => m.ReleasePage)),
      shell: true,
    },
    {
      path: '/dispatcher/fleet',
      title: 'Fleet',
      component: lazyPage(() => fleet().then((m) => m.FleetPage)),
      shell: true,
    },
    {
      path: '/dispatcher/tracking',
      title: 'Live tracking',
      component: lazyPage(() => fleet().then((m) => m.FleetPage), { tracking: true }),
      shell: true,
    },
    {
      path: '/dispatcher/analytics',
      title: 'Analytics',
      component: lazyPage(() => fleet().then((m) => m.AnalyticsPage)),
      shell: true,
    },
  ],
}
