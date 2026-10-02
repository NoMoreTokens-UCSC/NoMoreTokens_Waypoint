import type { Vehicle } from '../models'

/** Vehicle capability, capacity and live position. */
export interface FleetApi {
  listVehicles(): Promise<Vehicle[]>
  getVehicle(vehicleId: string): Promise<Vehicle | undefined>
}
