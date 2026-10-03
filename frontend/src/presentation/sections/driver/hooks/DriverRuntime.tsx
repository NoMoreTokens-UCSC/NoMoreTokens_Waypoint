import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useApis } from '../../../providers/ApisContext'
import { useOperations } from '../../../hooks/useOperations'
import { useSession } from '../../../session/useSession'

type LocationState = { tracking: boolean; error?: string; start: () => void; stop: () => void }
const LocationContext = createContext<LocationState | undefined>(undefined)

function DriverRuntime({ children }: { children: ReactNode }) {
  const apis = useApis(),
    session = useSession(),
    { data } = useOperations()
  const [tracking, setTracking] = useState(false)
  const [error, setError] = useState<string>()
  const lastWrite = useRef(0)
  const started = !!data?.settings.routeStarted
  useEffect(() => {
    if (!started) return
    let alive = true
    const check = () => {
      void apis.driverSignals
        .checkDeliveryWindows(new Date().toISOString())
        .catch((problem: unknown) => {
          if (alive)
            setError(
              problem instanceof Error ? problem.message : 'Deadline alerts could not be saved.',
            )
        })
    }
    check()
    const timer = window.setInterval(check, 60000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [apis, started])
  useEffect(() => {
    if (!tracking || !started || !session.vehicleId) return
    let alive = true
    lastWrite.current = 0
    const vehicleId = session.vehicleId
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (!alive || Date.now() - lastWrite.current < 10000) return
        lastWrite.current = Date.now()
        void apis.driverSignals
          .recordPosition({
            vehicleId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            recordedAt: new Date(position.timestamp).toISOString(),
          })
          .catch((problem: unknown) => {
            if (alive)
              setError(
                problem instanceof Error ? problem.message : 'The location could not be saved.',
              )
          })
      },
      (problem) => {
        if (!alive) return
        setError(
          problem.code === 1
            ? 'Location permission was denied. Enable it in browser settings to retry.'
            : problem.code === 2
              ? 'GPS is unavailable. The last saved position remains visible.'
              : 'GPS timed out. The last saved position remains visible.',
        )
        if (problem.code === 1) setTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => {
      alive = false
      navigator.geolocation.clearWatch(watch)
    }
  }, [apis, tracking, started, session.vehicleId])
  function start() {
    setError(undefined)
    if (!started) {
      setError('Start your assigned route before enabling location updates.')
      return
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      setError('Location updates require a supported browser on HTTPS or localhost.')
      return
    }
    setTracking(true)
  }
  return (
    <LocationContext.Provider
      value={{ tracking: tracking && started, error, start, stop: () => setTracking(false) }}
    >
      {children}
    </LocationContext.Provider>
  )
}
/** Keep the GPS watcher alive across Driver screens and stop it on workspace exit. */
export function DriverRuntimeBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return pathname.startsWith('/driver') ? <DriverRuntime>{children}</DriverRuntime> : children
}
export function useDriverLocation() {
  const state = useContext(LocationContext)
  if (!state) throw new Error('Driver location controls require the Driver runtime.')
  return state
}
