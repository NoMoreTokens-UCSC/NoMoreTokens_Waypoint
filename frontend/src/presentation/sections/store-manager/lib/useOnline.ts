import { useApiQuery } from '../../../hooks/useApiQuery'
import { useConnectivity } from '../../../hooks/useOperations'

/** True when the device is online and the demo's "Simulate offline" switch is off. */
export function useOnline() {
  const connected = useConnectivity()
  const settings = useApiQuery(['settings'], (apis) => apis.account.getSettings())
  return connected && !settings.data?.simulatedOffline
}
