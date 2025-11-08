import { Workbox } from 'workbox-window'

export const registerSW = () => {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  const wb = new Workbox('/sw.js')
  wb.addEventListener('waiting', () => {
    wb.messageSkipWaiting()
  })
  wb.addEventListener('controlling', () => {
    window.location.reload()
  })
  wb.register().catch((error) => {
    console.warn('Service worker registration failed', error)
  })
}
