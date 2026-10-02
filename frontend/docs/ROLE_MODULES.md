# Working on a role

Each role is a module that one person can own without touching anyone else's files. The shared
shell (sidebar, header, mobile navigation) and the data contract are common to all roles.

**Start here, then read [ROLE_GUIDES.md](ROLE_GUIDES.md)** for the current state, the definition of
done for a page, known issues, and the to-do list for your role.

## Who owns what

| Folder                                                              | Owner                 | Contains                                                           |
| ------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `src/presentation/sections/dispatcher`                              | Dispatcher            | pages, components and hooks for the role                           |
| `src/presentation/sections/store-manager`                           | Store manager         | 〃                                                                 |
| `src/presentation/sections/loader`                                  | Loader                | 〃                                                                 |
| `src/presentation/sections/driver`                                  | Driver                | 〃                                                                 |
| `src/presentation/sections/administration`                          | Administration        | 〃                                                                 |
| `src/presentation/sections/entry-account`                           | Shared                | welcome, how it works, login, workspace chooser, profile, settings |
| `src/presentation/sections/recovery`                                | Shared                | saved records and sync                                             |
| `src/presentation/shared`, `roles`, `session`, `providers`, `hooks` | Shared                | shell, UI kit, registry, identity, data hooks                      |
| `src/domain/api`                                                    | Shared (with backend) | the data contract                                                  |

Change shared code in its own small commit and tell the team. Lint stops one module importing another
module's folder: if two roles need the same component, move it to `presentation/shared`.

## A module's definition

Every module has an `index.ts` (for example `sections/store-manager/index.ts`) that declares its
label, icon, home page, navigation and routes:

```ts
routes: [
  {
    path: '/store-manager/deliveries',
    title: 'Deliveries', // shown in the breadcrumb
    component: lazyPage(() => pages().then((m) => m.StoreDeliveriesPage)),
    shell: true, // render inside the shared sidebar and header
  },
]
```

`App.tsx` builds every route from these definitions (`src/presentation/roles/registry.ts`), and the
shell builds its navigation from `nav`. You never edit `App.tsx` or the layout to add a screen.
`lazyPage(load, props)` splits each page into its own chunk and can pass fixed props, so one page
can serve several URLs.

## Adding or replacing a screen

1. Create the page in your folder, e.g. `sections/store-manager/pages/DeliveriesPage.tsx`, with
   components in `components/` and data hooks in `hooks/`.
2. Read data with `useApiQuery` and write with `useAction`:

   ```tsx
   const apis = useApis()
   const { outletId } = useSession()
   const orders = useApiQuery(['orders', outletId], (a) => a.orders.listOrders({ outletId }))
   const action = useAction()
   action.run(() => apis.orders.confirmReceipt(id), 'Receipt confirmed')
   ```

3. Point the route in your `index.ts` at the new page. Add a `nav` entry if it needs one.
4. Add the path to `e2e/routes.spec.ts` if it is new.
5. Run the checks below.

Rules of thumb:

- **Identity** (name, outlet, vehicle, depot) comes from `useSession()`. Don't hardcode `OUT001` or
  `VEH055`; that is where real sign-in will plug in.
- **Data** comes from `useApis()` (`src/domain/api`). The existing pages still call
  `useOperations()` / `useServices()`; move them to `useApis()` when you rewrite them. Screens must not
  import `src/infrastructure` (lint enforces this).
- **UI pieces**: reuse `shared/molecules/Common.tsx` (`PageHeading`, `Panel`, `Notice`, `StatusBadge`,
  `Field`, `Modal`, `Metric`, `EmptyState`), `shared/atoms/*` and `shared/organisms/*`
  (`OperationsMap`, `EvidenceDetails`, `PhotoCapture`).
- **Header search**: set `search` in your module to change what the header search finds.
- **Breadcrumb**: the shell shows "< Back | Home / {route title}". Home links to your module's `home`;
  Back returns to the previous screen (or home when opened directly). On a detail page, replace the page
  part with `useBreadcrumb([{ label: 'Deliveries', to: '/store-manager/deliveries' }, { label: orderId }])`
  from `shared/templates/Breadcrumbs`. Every item except the last is a link.
- **Design reference**: the Figma screen images, not the Figma renderer code. The renderer is dead
  code (`docs/FIGMA_DEAD_CODE.md`) and lint blocks importing it.

## Integrating a backend

All screen data goes through the interfaces in `src/domain/api` (`OrdersApi`, `PlanningApi`,
`LoadingApi`, `DeliveryApi`, `FleetApi`, `TeamApi`, `AccountApi`). They are grouped by data, not by
role, because one order passes through every role.

Today `src/infrastructure/local/localApis.ts` implements them in the browser (IndexedDB, through
`OperationsService`). To use a server:

1. Implement one interface over HTTP, e.g. `src/infrastructure/http/HttpOrdersApi.ts`.
2. Return it from `createApis()` in `src/app/apis.ts`. Areas can move one at a time.
3. Screens using `useApis()` don't change. Revisit query invalidation in `useApiQuery` (today every
   API query refreshes after any local write).

Business rules (cutoff, capacity, temperature, publication checks) live in `src/domain` and
`src/application` and import no React or browser storage (lint enforces this), so they can be
reused on a server.

## Checks before you commit

Run in `frontend/`:

```powershell
npm run lint
npm run test
npm run build
npm run test:e2e   # first time: npx playwright install chromium
```
