import { lazy, type ComponentType } from 'react'

/**
 * Lazily loads a named page export, optionally with fixed props, so each route
 * is split into its own chunk and modules can reuse one page for several URLs.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>, props?: P) {
  return lazy(async () => {
    const Page = await load()
    function BoundPage() {
      return <Page {...(props ?? ({} as P))} />
    }
    return { default: BoundPage as ComponentType }
  })
}
