import { AlertTriangle, Camera, Home, MapPin, Truck } from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

const pages = () => import('./pages/DriverPages')

export const driverModule: RoleModule = {
  key: 'driver',
  label: 'Driver',
  description: 'Deliver, record and sync.',
  icon: Truck,
  basePath: '/driver',
  home: '/driver/home',
  nav: [
    { label: 'Home', path: '/driver/home', icon: Home },
    { label: 'Current route', path: '/driver/route', icon: MapPin },
    { label: 'Delivery proof', path: '/driver/delivery', icon: Camera },
    { label: 'Issues', path: '/driver/issues', icon: AlertTriangle },
  ],
  routes: [
    {
      path: '/driver/home',
      component: lazyPage(() => pages().then((m) => m.DriverHomePage)),
      shell: true,
    },
    {
      path: '/driver/route',
      component: lazyPage(() => pages().then((m) => m.DriverRoutePage)),
      shell: true,
    },
    {
      path: '/driver/delivery',
      component: lazyPage(() => pages().then((m) => m.DriverDeliveryPage)),
      shell: true,
    },
    {
      path: '/driver/issues',
      component: lazyPage(() => pages().then((m) => m.DriverIssuesPage)),
      shell: true,
    },
  ],
}
