import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const checkInstalled = () => {
      const standaloneMedia =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(display-mode: standalone)').matches
          : false
      setIsInstalled(standaloneMedia || Boolean((navigator as any).standalone))
    }
    checkInstalled()
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setIsInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('DOMContentLoaded', checkInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('DOMContentLoaded', checkInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setPromptEvent(null)
    return choice.outcome === 'accepted'
  }, [promptEvent])

  return {
    canInstall: Boolean(promptEvent),
    promptInstall,
    isInstalled,
  }
}
