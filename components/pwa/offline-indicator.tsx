'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { onSyncStatusChange, startAutoSync, processSyncQueue, type SyncStatus } from '@/lib/sync-manager'

export function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pending, setPending] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Start the background sync engine
    startAutoSync()

    // Listen for sync status changes
    const unsubscribe = onSyncStatusChange((newStatus, pendingCount) => {
      setStatus(newStatus)
      setPending(pendingCount)
    })

    // Listen for Background Sync triggers from the SW
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_SYNC_TRIGGER') {
        processSyncQueue()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      unsubscribe()
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  // Show/hide logic: visible when offline, syncing with pending items, or error
  useEffect(() => {
    if (status === 'offline' || (status === 'syncing' && pending > 0) || status === 'error') {
      setVisible(true)
    } else if (status === 'idle' && pending === 0) {
      // Brief "synced" flash then hide
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [status, pending])

  if (!visible) return null

  return (
    <div className="fixed top-14 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className={`
          pointer-events-auto mx-4 px-3 py-1.5 rounded-full text-xs font-medium
          flex items-center gap-1.5 shadow-md border
          transition-all duration-300
          ${status === 'offline'
            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
            : status === 'syncing'
              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
              : status === 'error'
                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
                : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800'
          }
        `}
      >
        {status === 'offline' && (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Офлайн{pending > 0 ? ` \u00B7 ${pending} в очереди` : ''}</span>
          </>
        )}
        {status === 'syncing' && (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Синхронизация{pending > 0 ? ` (${pending})` : ''}...</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertTriangle className="h-3 w-3" />
            <span>Ошибка синхронизации{pending > 0 ? ` \u00B7 ${pending} в очереди` : ''}</span>
          </>
        )}
        {status === 'idle' && pending === 0 && (
          <>
            <Check className="h-3 w-3" />
            <span>Синхронизировано</span>
          </>
        )}
      </div>
    </div>
  )
}
