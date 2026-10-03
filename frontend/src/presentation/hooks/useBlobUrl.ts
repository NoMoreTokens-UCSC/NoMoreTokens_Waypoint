import { useMemo, useSyncExternalStore } from 'react'

function createBlobUrlStore(blob?: Blob) {
  let url: string | undefined
  return {
    getSnapshot: () => url,
    subscribe: (notify: () => void) => {
      if (!blob) return () => {}
      const allocated = URL.createObjectURL(blob)
      url = allocated
      notify()
      return () => {
        URL.revokeObjectURL(allocated)
        url = undefined
      }
    },
  }
}

/** Object URLs are external resources: allocate on subscription, release on cleanup. */
export function useBlobUrl(blob?: Blob) {
  const store = useMemo(() => createBlobUrlStore(blob), [blob])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => undefined)
}
