import { Bell, Home, Package, Truck } from 'lucide-react'
import { createElement, type ComponentType } from 'react'
import { lazyPage } from '../../roles/lazyPage'
import type { RoleModule } from '../../roles/types'
import { lateOrders } from './lib/lateness'
import { BellFilledIcon, BoxIcon, GridIcon, TruckIcon } from './components/StoreIcons'

const route = (path: string, title: string, page: () => Promise<{ default: ComponentType }>) => ({
  path,
  title,
  component: lazyPage(() => page().then((m) => m.default)),
  shell: true,
})

const delivery = '/store-manager/deliveries'
const openOrders = '/store-manager/orders/confirmed'

export const storeManagerModule: RoleModule = {
  key: 'store-manager',
  label: 'Store Manager',
  description: 'Order, track and confirm receipt.',
  icon: Package,
  basePath: '/store-manager',
  home: '/store-manager/overview',
  nav: [
    {
      label: 'Overview',
      menuLabel: 'Order placement',
      path: '/store-manager/overview',
      icon: Home,
      renderIcon: (active) => createElement(GridIcon, { active }),
    },
    {
      label: 'Orders',
      path: '/store-manager/orders',
      icon: Package,
      renderIcon: (active) => createElement(BoxIcon, { active }),
    },
    {
      label: 'Deliveries',
      menuLabel: 'Delivery tracking',
      path: delivery,
      icon: Truck,
      renderIcon: (active) => createElement(TruckIcon, { active }),
    },
    {
      label: 'Alerts',
      path: '/store-manager/alerts',
      icon: Bell,
      renderIcon: (active) => createElement(BellFilledIcon, { active }),
    },
  ],
  search: {
    placeholder: 'Search orders, deliveries or issues',
    find: (snapshot, query, session) => {
      const text = query.toLowerCase()
      return [...snapshot.orders, ...(snapshot.orderHistory ?? [])]
        .filter((order) => order.outlet === session.outletId)
        .filter((order) =>
          `${order.id} ${order.reference ?? ''} ${order.temperature} ${order.status} ${order.issue ?? ''}`
            .toLowerCase()
            .includes(text),
        )
        .map((order) => ({
          id: order.id,
          text: `${order.reference ?? order.id} · ${order.temperature === 'Chilled' ? 'Fresh / Chilled' : 'Fresh / Dry'} · ${order.status}`,
          path: `/store-manager/orders/${order.id}`,
        }))
    },
  },
  shell: {
    compactBelow: 761,
    compactNav: 'tabs',
    // The store has its own account pages; the shared ones show other roles' data.
    accountPaths: {
      profile: '/store-manager/profile',
      settings: '/store-manager/settings',
      notifications: '/store-manager/notifications',
    },
    recoveryLink: false,
    identity: (session) => ({
      title: session.outletId ?? 'Store',
      subtitle: 'Waypoint Group · NoMoreTokens',
    }),
    compactSubtitle: (session) => `Store · ${session.outletId ?? ''}`,
    // Count this outlet's unread delivery updates, deferrals and late arrivals.
    alertCount: (snapshot, session) =>
      snapshot.orders.filter(
        (order) =>
          order.outlet === session.outletId &&
          order.status === 'Deferred' &&
          !order.deferralAcknowledged,
      ).length +
      lateOrders(
        snapshot.orders.filter((order) => order.outlet === session.outletId),
        snapshot.stops,
      ).length +
      (snapshot.deliveryNotices ?? []).filter(
        (notice) => notice.outletId === session.outletId && !notice.readAt,
      ).length,
  },
  routes: [
    route('/store-manager/overview', 'Order placement', () => import('./pages/OverviewPage')),
    route('/store-manager/orders', 'Orders', () => import('./pages/OrdersPage')),
    route('/store-manager/orders/new', 'Create orders', () => import('./pages/CreateOrdersPage')),
    route('/store-manager/orders/review', 'Review & confirm', () => import('./pages/ReviewPage')),
    route(openOrders, 'Orders confirmed', () => import('./pages/ConfirmedPage')),
    route(
      '/store-manager/orders/draft',
      'Draft saved for next run',
      () => import('./pages/DraftSavedPage'),
    ),
    route(delivery, 'Tracking', () => import('./pages/TrackingPage')),
    route(
      `${delivery}/confirm`,
      'Confirm delivery handoff',
      () => import('./pages/StoreHandoffPage'),
    ),
    route(`${delivery}/:orderId/receipt`, 'Confirm receipt', () => import('./pages/ReceiptPage')),
    route(
      `${delivery}/:orderId/receipt/confirmed`,
      'Receipt confirmed',
      () => import('./pages/ReceiptConfirmedPage'),
    ),
    route(
      `${delivery}/:orderId/issue`,
      'Report a delivery issue',
      () => import('./pages/IssuePage'),
    ),
    route(
      `${delivery}/:orderId/issue/submitted`,
      'Issue submitted',
      () => import('./pages/IssueSubmittedPage'),
    ),
    route('/store-manager/alerts', 'Alerts', () => import('./pages/AlertsPage')),
    route(
      '/store-manager/notifications',
      'Notifications',
      () => import('./pages/NotificationsPage'),
    ),
    route('/store-manager/profile', 'Profile', () => import('./pages/ProfilePage')),
    route('/store-manager/settings', 'Preferences', () => import('./pages/SettingsPage')),
    // Last: a path parameter, so the fixed paths above (new, review, confirmed, draft) win.
    route('/store-manager/orders/:orderId', 'Order', () => import('./pages/OrderDetailPage')),
  ],
}
