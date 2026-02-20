'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 30 * 60 * 1000) // every 30 minutes

          // Register Background Sync for offline mutations
          if ('sync' in registration) {
            (registration as unknown as { sync: { register: (tag: string) => Promise<void> } })
              .sync.register('kaloritrack-sync').catch(() => {})
          }

          // Listen for new SW waiting to activate
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (!newWorker) return
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available, tell it to activate immediately
                newWorker.postMessage('skipWaiting')
              }
            })
          })
        })
        .catch((err) => {
          console.error('SW registration failed:', err)
        })

      // Reload page when new SW takes over
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })
    }

    // Check if already in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    if (standalone) return // Already installed, no need for banner

    // Detect iOS
    const ua = window.navigator.userAgent
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(isiOS)

    // Listen for the install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show banner after a short delay to not interrupt user
      setTimeout(() => setShowInstallBanner(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // If iOS, show a manual hint after a delay
    if (isiOS) {
      const dismissed = sessionStorage.getItem('pwa-ios-dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 5000)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    if (isIOS) {
      sessionStorage.setItem('pwa-ios-dismissed', 'true')
    }
  }

  if (isStandalone || !showInstallBanner) return null

  return (
    <div className="fixed bottom-4 left-2 right-2 sm:left-4 sm:right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-md mx-auto bg-card border shadow-lg rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-card-foreground">Установить КалориТрек</p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {'Нажмите '}
                <span className="font-medium">Поделиться</span>
                {' -> '}
                <span className="font-medium">На экран Домой</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Добавьте на главный экран для быстрого доступа
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isIOS && deferredPrompt && (
              <Button size="sm" className="h-8 text-xs" onClick={handleInstall}>
                Установить
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
