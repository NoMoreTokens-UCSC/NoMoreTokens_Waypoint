import { createContext, useContext } from 'react'
import type { OperationsService } from '../../application/OperationsService'
export const ServicesContext = createContext<OperationsService | null>(null)
export function useServices() {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Operations services are not configured.')
  return services
}
