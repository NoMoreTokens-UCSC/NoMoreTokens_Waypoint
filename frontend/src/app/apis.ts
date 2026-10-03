import type { Apis } from '../domain/api'
import type { OperationsService } from '../application/OperationsService'
import { createLocalApis } from '../infrastructure/local/localApis'
import { createHttpApis } from '../infrastructure/http/httpApis'
import { getToken } from '../infrastructure/http/apiClient'

/**
 * The one place that chooses where data comes from.
 *
 * - When VITE_API_URL is set AND a JWT token exists in localStorage → real backend.
 * - Otherwise → local IndexedDB demo (unchanged behaviour for offline dev).
 */
export function createApis(service: OperationsService, outletId?: string): Apis {
  const useRealApi =
    !!import.meta.env.VITE_API_URL &&
    import.meta.env.VITE_API_URL !== '' &&
    !!getToken()

  if (useRealApi) {
    return createHttpApis(outletId)
  }
  return createLocalApis(service)
}
