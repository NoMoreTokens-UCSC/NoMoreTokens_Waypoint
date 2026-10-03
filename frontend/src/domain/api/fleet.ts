import type { NewVehicle } from '../fleet'
import type { Vehicle } from '../models'

/** Vehicle capability, capacity and live position. */
export interface FleetApi {
  listVehicles(): Promise<Vehicle[]>
  getVehicle(vehicleId: string): Promise<Vehicle | undefined>
  /**
   * Adds a vehicle with the next free id, available at its depot. Fails for a refrigerated vehicle
   * that is not Fresh, a capacity outside the sensible range, or a registration already in use.
   */
  createVehicle(input: NewVehicle): Promise<Vehicle>
}
