/**
 * Background sync manager.
 * Processes the offline mutation queue when connectivity returns.
 *
 * Conflict resolution strategy: **last-write-wins**.
 * - Every mutation carries a timestamp from when the user performed the action.
 * - The server API uses upsert semantics (findById -> merge), so replaying
 *   mutations in chronological order gives correct final state.
 * - Deletes are idempotent (deleting a non-existent record is a no-op server-side).
 *
 * The manager exposes an event-driven API so UI can show sync status.
 */

import {
  getPendingSyncItems,
  removeSyncItem,
  updateSyncItem,
  getPendingSyncCount,
  setMetaValue,
  type SyncQueueItem,
} from './offline-store'

const API_BASE = '/api/data'
const MAX_RETRIES = 5

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

type SyncListener = (status: SyncStatus, pending: number) => void

const listeners = new Set<SyncListener>()
let currentStatus: SyncStatus = navigator.onLine ? 'idle' : 'offline'
let currentPending = 0
let isSyncing = false

// ─── Public API ───

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener)
  // Immediately notify with current state
  listener(currentStatus, currentPending)
  return () => listeners.delete(listener)
}

export function getSyncStatus(): { status: SyncStatus; pending: number } {
  return { status: currentStatus, pending: currentPending }
}

function notify(status: SyncStatus, pending: number) {
  currentStatus = status
  currentPending = pending
  for (const listener of listeners) {
    try {
      listener(status, pending)
    } catch {
      // Don't let one bad listener break others
    }
  }
}

/**
 * Process all pending sync items.
 * Called when connectivity returns or after a new mutation is enqueued.
 */
export async function processSyncQueue(): Promise<void> {
  if (isSyncing) return
  if (!navigator.onLine) {
    const count = await getPendingSyncCount()
    notify('offline', count)
    return
  }

  isSyncing = true
  const items = await getPendingSyncItems()

  if (items.length === 0) {
    isSyncing = false
    notify('idle', 0)
    return
  }

  notify('syncing', items.length)

  let remaining = items.length
  let hadError = false

  for (const item of items) {
    try {
      const success = await replayMutation(item)
      if (success) {
        await removeSyncItem(item.id)
        remaining--
        notify('syncing', remaining)
      } else {
        // Increment retries
        item.retries += 1
        if (item.retries >= MAX_RETRIES) {
          // Drop permanently failed items
          console.warn(`[sync] Dropping item ${item.id} after ${MAX_RETRIES} retries`)
          await removeSyncItem(item.id)
          remaining--
        } else {
          await updateSyncItem(item)
          hadError = true
        }
      }
    } catch (err) {
      console.error(`[sync] Error processing item ${item.id}:`, err)
      item.retries += 1
      if (item.retries >= MAX_RETRIES) {
        await removeSyncItem(item.id)
        remaining--
      } else {
        await updateSyncItem(item)
        hadError = true
      }
    }
  }

  await setMetaValue('lastSyncedAt', new Date().toISOString())
  isSyncing = false
  notify(hadError ? 'error' : 'idle', remaining)
}

async function replayMutation(item: SyncQueueItem): Promise<boolean> {
  const url = item.url.startsWith('/') ? item.url : `${API_BASE}${item.url}`

  try {
    const init: RequestInit = {
      method: item.method,
      headers: item.body ? { 'Content-Type': 'application/json' } : undefined,
      body: item.body || undefined,
    }

    const response = await fetch(url, init)

    // 2xx = success, 4xx = client error (don't retry), 5xx = server error (retry)
    if (response.ok) return true
    if (response.status >= 400 && response.status < 500) {
      console.warn(`[sync] Client error ${response.status} for ${item.method} ${url}, dropping`)
      return true // Drop — retrying won't help
    }
    return false // 5xx — will retry
  } catch {
    // Network error — will retry
    return false
  }
}

// ─── Automatic triggers ───

/** Try to sync whenever we come back online */
export function startAutoSync(): void {
  window.addEventListener('online', () => {
    notify('syncing', currentPending)
    processSyncQueue()
  })

  window.addEventListener('offline', async () => {
    const count = await getPendingSyncCount()
    notify('offline', count)
  })

  // Periodic sync check every 2 minutes when online
  setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      processSyncQueue()
    }
  }, 2 * 60 * 1000)

  // Initial sync attempt
  if (navigator.onLine) {
    processSyncQueue()
  }
}

/**
 * Trigger a sync attempt after enqueueing a new mutation.
 * Non-blocking — fires and forgets.
 */
export function triggerSync(): void {
  if (navigator.onLine && !isSyncing) {
    processSyncQueue()
  }
}
