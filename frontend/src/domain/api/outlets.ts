import type { NewOutlet, OutletProfile } from '../outlets'

/** The outlets in the system: administrators add them, store managers are assigned to them. */
export interface OutletsApi {
  listOutlets(): Promise<OutletProfile[]>
  /**
   * Adds an outlet. The system assigns the next id (OUT121 and so on) and returns the profile.
   * Fails when the name is missing or the receiving window is not at least an hour inside the day.
   */
  createOutlet(input: NewOutlet): Promise<OutletProfile>
}
