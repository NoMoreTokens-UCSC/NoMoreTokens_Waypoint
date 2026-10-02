import { Bell, Home, Package, Truck } from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const pages = () => import('./pages/StorePages')

export const storeManagerModule: RoleModule = {
  key: 'store-manager',
  label: 'Store Manager',
  description: 'Order, track and confirm receipt.',
  icon: Package,
  basePath: '/store-manager',
  home: '/store-manager/orders',
  nav: [
    { label: 'Overview', path: '/store-manager/overview', icon: Home },
    { label: 'Orders', path: '/store-manager/orders', icon: Package },
    { label: 'Deliveries', path: '/store-manager/deliveries', icon: Truck },
    { label: 'Alerts', path: '/store-manager/alerts', icon: Bell },
  ],
  routes: [
    {
      path: '/store-manager/overview',
      title: 'Overview',
      component: lazyPage(() => pages().then((m) => m.StoreOrdersPage), { overview: true }),
      shell: true,
    },
    {
      path: '/store-manager/orders',
      title: 'Orders',
      component: lazyPage(() => pages().then((m) => m.StoreOrdersPage)),
      shell: true,
    },
    {
      path: '/store-manager/deliveries',
      title: 'Deliveries',
      component: lazyPage(() => pages().then((m) => m.StoreDeliveriesPage)),
      shell: true,
    },
    {
      path: '/store-manager/alerts',
      title: 'Alerts',
      component: lazyPage(() => pages().then((m) => m.StoreAlertsPage)),
      shell: true,
    },
  ],
}
