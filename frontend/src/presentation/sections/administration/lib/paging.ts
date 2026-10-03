import { useState } from 'react'

/** Rows shown on one page of an administration list. */
export const pageSize = 10

/**
 * Pages through a list. The page goes back to the first whenever `key` changes (a new search or
 * filter), so a narrower list never leaves you on a page that no longer exists.
 */
export function usePaging<T>(items: T[], key: string, size = pageSize) {
  const [entry, setEntry] = useState({ key, page: 1 })
  const pages = Math.max(1, Math.ceil(items.length / size))
  // A new search or filter starts again from the first page. The stored page is replaced right away,
  // so coming back to an earlier filter does not bring its old page back.
  if (entry.key !== key) setEntry({ key, page: 1 })
  const page = Math.min(entry.key === key ? entry.page : 1, pages)
  const start = (page - 1) * size
  return {
    page,
    pages,
    visible: items.slice(start, start + size),
    /** 1-based position of the first and last row shown ("1–10"). */
    from: items.length ? start + 1 : 0,
    to: Math.min(start + size, items.length),
    setPage: (next: number) => setEntry({ key, page: next }),
  }
}
export type Paging = ReturnType<typeof usePaging>
