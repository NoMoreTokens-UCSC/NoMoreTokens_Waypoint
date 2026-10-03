import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAction } from '../../hooks/useOperations'

/** Navigate only after useAction has saved and refreshed the route query used by page guards. */
export function useHandoffAction() {
  const action = useAction()
  const navigate = useNavigate()
  function runAndNavigate(write: () => Promise<unknown>, to: string, message?: string) {
    action.mutate(write, {
      onSuccess: () => {
        if (message) toast.success(message)
        navigate(to)
      },
    })
  }
  return { ...action, runAndNavigate }
}
