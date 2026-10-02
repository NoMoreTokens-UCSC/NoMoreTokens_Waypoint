import type { Load, LoadIssueInput, Stop, Vehicle } from '../models'

export interface LoadingWorkspace {
  load: Load
  vehicle: Vehicle
  published: boolean
  stops: Stop[]
  weight: number
  volume: number
}

/** Dock work for the loader: quantities, safety checks, shortfalls and loading proof. */
export interface LoadingApi {
  listLoads(filter?: { depot?: string }): Promise<Load[]>
  getLoad(loadId: string): Promise<Load | undefined>
  getWorkspace(loadId: string, depot?: string): Promise<LoadingWorkspace | undefined>
  acknowledgeRevision(loadId: string, expectedRevision: number): Promise<void>
  setLoaded(
    loadId: string,
    outlet: string,
    quantity: number,
    expectedRevision?: number,
  ): Promise<void>
  setCheck(
    loadId: string,
    check: keyof Load['checks'],
    checked: boolean,
    expectedRevision?: number,
  ): Promise<void>
  reportIssue(
    loadId: string,
    issue: string | LoadIssueInput,
    expectedRevision?: number,
  ): Promise<void>
  resolveIssue(loadId: string): Promise<void>
  attachPhoto(loadId: string, file: File, expectedRevision?: number): Promise<void>
  complete(loadId: string, expectedRevision?: number): Promise<void>
}
