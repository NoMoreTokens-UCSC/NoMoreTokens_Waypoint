import type { Apis } from '../domain/api'
import type { OperationsService } from '../application/OperationsService'
import { createLocalApis } from '../infrastructure/local/localApis'

/**
 * The one place that chooses where data comes from. To integrate a backend, implement the
 * interfaces in src/domain/api with HTTP adapters and return them here, one area at a time.
 */
export function createApis(service: OperationsService): Apis {
  return createLocalApis(service)
}
