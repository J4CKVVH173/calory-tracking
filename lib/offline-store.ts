/**
 * IndexedDB-backed offline data store.
 * Mirrors the server DataStore model locally with an additional sync queue
 * for pending mutations that must be replayed when connectivity returns.
 *
 * Schema (object stores):
 *   data      — full DataStore snapshot keyed by "snapshot"
 *   syncQueue — ordered pending mutations { id, timestamp, action, payload }
 *   meta      — key-value pairs (lastSyncedAt, etc.)
 */

const DB_NAME = 'kaloritrack-offline'
const DB_VERSION = 1

export interface SyncQueueItem {
  id: string
  timestamp: string
  /** HTTP method */
  method: 'POST' | 'DELETE'
  /** URL path + search params */
  url: string
  /** JSON body (POST only) */
  body?: string
  /** Retry count */
  retries: number
}

export interface OfflineDataSnapshot {
  [key: string]: unknown
}

// ─── DB Initialization ───

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data')
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── Generic helpers ───

async function getFromStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

async function putInStore(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = key !== undefined ? store.put(value, key) : store.put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ─── Data snapshot (cached server response) ───

/**
 * Cache an API GET response by its URL key.
 * Stored as: key = URL string, value = parsed JSON.
 */
export async function cacheApiResponse(url: string, data: unknown): Promise<void> {
  await putInStore('data', { data, cachedAt: new Date().toISOString() }, url)
}

/**
 * Retrieve cached API response.
 * Returns undefined if no cached data exists.
 */
export async function getCachedApiResponse<T>(url: string): Promise<{ data: T; cachedAt: string } | undefined> {
  return getFromStore<{ data: T; cachedAt: string }>('data', url)
}

// ─── Sync queue ───

/**
 * Enqueue a mutation to be replayed against the server when online.
 */
export async function enqueueMutation(item: Omit<SyncQueueItem, 'id' | 'retries'>): Promise<string> {
  const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry: SyncQueueItem = { ...item, id, retries: 0 }
  await putInStore('syncQueue', entry)
  return id
}

/**
 * Get all pending sync items ordered by timestamp.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const items = await getAllFromStore<SyncQueueItem>('syncQueue')
  return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/**
 * Remove a successfully synced item from the queue.
 */
export async function removeSyncItem(id: string): Promise<void> {
  await deleteFromStore('syncQueue', id)
}

/**
 * Update a sync item (e.g. increment retries).
 */
export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  await putInStore('syncQueue', item)
}

/**
 * Get the number of pending sync items.
 */
export async function getPendingSyncCount(): Promise<number> {
  const items = await getAllFromStore<SyncQueueItem>('syncQueue')
  return items.length
}

/**
 * Clear the entire sync queue (e.g. after a full sync).
 */
export async function clearSyncQueue(): Promise<void> {
  await clearStore('syncQueue')
}

// ─── Meta ───

export async function getMetaValue<T>(key: string): Promise<T | undefined> {
  return getFromStore<T>('meta', key)
}

export async function setMetaValue(key: string, value: unknown): Promise<void> {
  await putInStore('meta', value, key)
}

// ─── Local data mutation (optimistic updates) ───

/**
 * Apply a POST mutation optimistically to the local cached data.
 * This updates the relevant cached GET response so the UI sees
 * the change immediately even while offline.
 */
export async function applyLocalMutation(type: string, data: Record<string, unknown>): Promise<void> {
  const typeToCollectionMap: Record<string, { urlPattern: string; collection: string; idField: string }> = {
    user: { urlPattern: 'type=users', collection: 'users', idField: 'id' },
    profile: { urlPattern: 'type=profile', collection: 'profiles', idField: 'userId' },
    weightEntry: { urlPattern: 'type=weightEntries', collection: 'weightEntries', idField: 'id' },
    foodLog: { urlPattern: 'type=foodLogs', collection: 'foodLogs', idField: 'id' },
    bodyMeasurement: { urlPattern: 'type=bodyMeasurements', collection: 'bodyMeasurements', idField: 'id' },
    product: { urlPattern: 'type=products', collection: 'products', idField: 'id' },
    userFavorite: { urlPattern: 'type=userFavorites', collection: 'userFavorites', idField: 'id' },
  }

  const mapping = typeToCollectionMap[type]
  if (!mapping) return

  // Find all cached URLs that contain the matching pattern
  const db = await openDB()
  const tx = db.transaction('data', 'readwrite')
  const store = tx.objectStore('data')

  return new Promise((resolve, reject) => {
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const key = cursor.key as string
        if (typeof key === 'string' && key.includes(mapping.urlPattern)) {
          const cached = cursor.value as { data: unknown; cachedAt: string }
          const arr = cached.data
          if (Array.isArray(arr)) {
            const idField = mapping.idField
            const existingIdx = arr.findIndex(
              (item: Record<string, unknown>) => item[idField] === data[idField]
            )
            if (existingIdx >= 0) {
              arr[existingIdx] = { ...arr[existingIdx], ...data }
            } else {
              arr.push(data)
            }
            cursor.update({ data: arr, cachedAt: new Date().toISOString() })
          }
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Apply a DELETE mutation optimistically to the local cached data.
 */
export async function applyLocalDeletion(type: string, id: string): Promise<void> {
  const typeToUrlPattern: Record<string, string> = {
    foodLog: 'type=foodLogs',
    product: 'type=products',
    userFavorite: 'type=userFavorites',
  }

  const pattern = typeToUrlPattern[type]
  if (!pattern) return

  const db = await openDB()
  const tx = db.transaction('data', 'readwrite')
  const store = tx.objectStore('data')

  return new Promise((resolve, reject) => {
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const key = cursor.key as string
        if (typeof key === 'string' && key.includes(pattern)) {
          const cached = cursor.value as { data: unknown; cachedAt: string }
          const arr = cached.data
          if (Array.isArray(arr)) {
            const filtered = arr.filter((item: Record<string, unknown>) => item.id !== id)
            cursor.update({ data: filtered, cachedAt: new Date().toISOString() })
          }
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}
