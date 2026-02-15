'use client'

import { useEffect } from 'react'

/**
 * Hook to register and manage the service worker.
 * Note: The primary SW registration happens in PWAProvider.
 * This hook is kept for components that need to interact with the SW directly.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 30 * 60 * 1000) // every 30 minutes
        })
        .catch((error) => {
          console.error('SW registration failed:', error)
        })
    }
  }, [])
}

/** Send a message to the active service worker */
export function sendSWMessage(message: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message)
  }
}
