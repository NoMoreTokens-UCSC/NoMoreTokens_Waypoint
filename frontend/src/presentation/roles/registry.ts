import { administrationModule } from '../sections/administration'
import { dispatcherModule } from '../sections/dispatcher'
import { driverModule } from '../sections/driver'
import { entryAccountModule } from '../sections/entry-account'
import { loaderModule } from '../sections/loader'
import { recoveryModule } from '../sections/recovery'
import { storeManagerModule } from '../sections/store-manager'
import type { AppModule, RoleModule } from './types'

/** Role workspaces, in the order the workspace switcher lists them. */
export const roleModules: RoleModule[] = [
  dispatcherModule,
  storeManagerModule,
  loaderModule,
  driverModule,
  administrationModule,
]

/** Every module that contributes routes. */
export const appModules: AppModule[] = [...roleModules, entryAccountModule, recoveryModule]

export const appRoutes = appModules.flatMap((module) => module.routes)
