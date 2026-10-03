import { useEffect, useState } from 'react'
interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export function usePwaInstall() {
  const [prompt, setPrompt] = useState<InstallEvent>()
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallEvent)
    }
    const complete = () => {
      setInstalled(true)
      setPrompt(undefined)
    }
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', complete)
    return () => {
      window.removeEventListener('beforeinstallprompt', available)
      window.removeEventListener('appinstalled', complete)
    }
  }, [])
  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPrompt(undefined)
  }
  return { available: !!prompt, installed, install }
}
