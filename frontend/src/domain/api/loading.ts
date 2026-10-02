import type { Load } from '../models'

/** Dock work for the loader: quantities, safety checks, shortfalls and loading proof. */
export interface LoadingApi {
  listLoads(): Promise<Load[]>
  getLoad(loadId: string): Promise<Load | undefined>
  setLoaded(loadId: string, outlet: string, quantity: number): Promise<void>
  setCheck(loadId: string, check: keyof Load['checks'], checked: boolean): Promise<void>
  reportIssue(loadId: string, issue: string): Promise<void>
  resolveIssue(loadId: string): Promise<void>
  attachPhoto(loadId: string, file: File): Promise<void>
  complete(loadId: string): Promise<void>
}
