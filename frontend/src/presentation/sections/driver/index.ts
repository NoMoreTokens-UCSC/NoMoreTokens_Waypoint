import { AlertTriangle, Camera, Home, MapPin, Truck, CloudUpload } from 'lucide-react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'

export const driverModule: RoleModule = {
  key: 'driver',
  label: 'Driver',
  description: 'Deliver, record and sync.',
  icon: Truck,
  basePath: '/driver',
  home: '/driver/home',
  shell: { compactNav: 'menu', recoveryLink: false },
  nav: [
    { label: 'Home', path: '/driver/home', icon: Home },
    { label: 'Current route', path: '/driver/route', icon: MapPin },
    { label: 'Delivery proof', path: '/driver/delivery', icon: Camera },
    { label: 'Issues', path: '/driver/issues', icon: AlertTriangle },
    { label: 'Saved records', path: '/driver/sync', icon: CloudUpload },
  ],
  routes: [
    {
      path: '/driver/home',
      title: 'Home',
      component: lazyPage(() => import('./pages/DriverHomePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/route',
      title: 'Current route',
      component: lazyPage(() => import('./pages/DriverCurrentRoutePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/delivery',
      title: 'Delivery proof',
      component: lazyPage(() => import('./pages/DriverDeliveryPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/issues',
      title: 'Issues',
      component: lazyPage(() => import('./pages/DriverIssuePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/pre-departure',
      title: 'Before you leave',
      component: lazyPage(() => import('./pages/DriverPreDeparturePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/route/details',
      title: 'Manifest',
      component: lazyPage(() => import('./pages/DriverRouteDetailsPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/navigation',
      title: 'Navigation',
      component: lazyPage(() => import('./pages/DriverNavigationPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/arrival',
      title: 'Arrived',
      component: lazyPage(() => import('./pages/DriverArrivalPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/proof/capture',
      title: 'Capture proof',
      component: lazyPage(() => import('./pages/DriverProofCapturePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/proof/camera-unavailable',
      title: 'Camera access',
      component: lazyPage(() =>
        import('./pages/DriverCameraUnavailablePage').then((m) => m.default),
      ),
      shell: true,
    },
    {
      path: '/driver/proof/review',
      title: 'Photo review',
      component: lazyPage(() => import('./pages/DriverProofReviewPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/proof/attached',
      title: 'Photo attached',
      component: lazyPage(() => import('./pages/DriverProofAttachedPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/proof/submit',
      title: 'Submit proof',
      component: lazyPage(() => import('./pages/DriverProofSubmitPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/delivered',
      title: 'Delivered',
      component: lazyPage(() => import('./pages/DriverDeliveredPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/offline',
      title: 'Offline route',
      component: lazyPage(() => import('./pages/DriverOfflinePage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/sync',
      title: 'Saved records',
      component: lazyPage(() => import('./pages/DriverSyncPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/route/revision',
      title: 'Route revision',
      component: lazyPage(() => import('./pages/DriverRouteRevisionPage').then((m) => m.default)),
      shell: true,
    },
    {
      path: '/driver/sync/history',
      title: 'Sync history',
      component: lazyPage(() => import('./pages/DriverSyncHistoryPage').then((m) => m.default)),
      shell: true,
    },
  ],
}
