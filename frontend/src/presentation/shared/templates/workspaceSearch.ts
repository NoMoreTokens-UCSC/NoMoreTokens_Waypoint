import type { HeaderSearch } from '../../roles/types'

/** Default header search: orders and vehicles, opened in the dispatcher's views. */
export const workspaceSearch: HeaderSearch = {
  placeholder: 'Search orders, outlets or vehicles',
  find: (snapshot, query) => {
    const text = query.toLowerCase()
    return [
      ...snapshot.orders
        .filter((o) => `${o.id} ${o.outlet} ${o.outletName}`.toLowerCase().includes(text))
        .slice(0, 6)
        .map((o) => ({
          id: o.id,
          text: `${o.id} · ${o.outletName}`,
          path: `/dispatcher/orders?search=${o.id}`,
        })),
      ...snapshot.vehicles
        .filter((v) => `${v.id} ${v.location}`.toLowerCase().includes(text))
        .slice(0, 4)
        .map((v) => ({
          id: v.id,
          text: `${v.id} · ${v.location}`,
          path: `/dispatcher/fleet?search=${v.id}`,
        })),
    ]
  },
}
