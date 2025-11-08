declare global {
  interface Window {
    global?: typeof globalThis
  }
}

if (typeof window !== 'undefined' && !window.global) {
  window.global = window
}

export {}
