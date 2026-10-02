import { useSyncExternalStore } from 'react'

/** Tracks a CSS media query, e.g. `useMediaQuery('(max-width: 1199px)')`. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
