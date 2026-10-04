/** One depot, brand and ISO week of demand, in cubic metres. */
export interface DemandWeek {
  depot: string
  brand: string
  isoYear: number
  isoWeek: number
  totalM3: number
  chilledM3: number
  isEventWeek: boolean
  /** True for the weeks in the booklet's test horizon. */
  inTestHorizon?: boolean
}

/** Vehicles and reefers a depot needs for one week's forecast volume, against its fleet. */
export interface WeekCapacity {
  depot: string
  isoYear: number
  isoWeek: number
  totalM3: number
  chilledM3: number
  operatingDays: number
  vehiclesNeeded: number
  vehiclesAvailable: number
  reefersNeeded: number
  reefersAvailable: number
  driversNeeded: number
  driversAvailable: number
  shortfallVehicles: number
  shortfallReefers: number
}

export interface DemandForecast {
  /** How the forecast is produced, shown to the dispatcher. */
  method: string
  history: DemandWeek[]
  forecast: DemandWeek[]
  capacity: WeekCapacity[]
  backtest: Backtest
}

/** Forecast error measured on weeks already known, by hiding them and predicting from earlier data. */
export interface Backtest {
  weeks: string[]
  /** Share of demand the forecast got wrong, in percent. Null when there is nothing to compare. */
  wapePercent: number | null
  byDepot: Record<string, number | null>
}

/** Demand history and the forecast for the planning horizon. */
export interface AnalyticsApi {
  demandForecast(): Promise<DemandForecast>
}
