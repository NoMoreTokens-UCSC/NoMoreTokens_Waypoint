import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster, toast } from 'sonner'
import { AppProviders } from './app/providers/AppProviders'
import { App } from './app/App'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'

const updateSW = registerSW({
  onNeedRefresh() {
    toast('An application update is ready. Save your current form before reloading.', {
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => {
          void updateSW(true)
        },
      },
    })
  },
  onOfflineReady() {
    console.info('Waypoint application shell is available offline.')
  },
})
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
      <Toaster richColors position="top-right" />
    </AppProviders>
  </StrictMode>,
)
