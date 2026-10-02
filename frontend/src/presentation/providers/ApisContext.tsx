import { createContext, useContext } from 'react'
import type { Apis } from '../../domain/api'

export const ApisContext = createContext<Apis | null>(null)
/** Data access for screens. Use this, not useServices(), in new or rewritten pages. */
export function useApis() {
  const apis = useContext(ApisContext)
  if (!apis) throw new Error('APIs are not configured.')
  return apis
}
