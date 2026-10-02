import type { Settings } from '../models'

/** The signed-in person's profile and preferences. */
export interface AccountApi {
  getSettings(): Promise<Settings>
  updateSettings(values: Partial<Settings>): Promise<void>
  saveProfilePhoto(file: File): Promise<void>
}
