/**
 * Offline-first API storage layer.
 *
 * READ operations:
 *   1. Try network fetch
 *   2. On success: cache response in IndexedDB, return data
 *   3. On failure: return cached IndexedDB data (instant offline reads)
 *
 * WRITE operations (POST/DELETE):
 *   1. Apply optimistic update to IndexedDB cache immediately
 *   2. Enqueue mutation in sync queue
 *   3. If online: attempt immediate server push (via sync manager)
 *   4. If offline: mutation stays queued, replayed on reconnect
 */

import type { User, UserProfile, WeightEntry, FoodLog, BodyMeasurement, SavedFood, Product, UserFavorite } from './types'
import {
  cacheApiResponse,
  getCachedApiResponse,
  enqueueMutation,
  applyLocalMutation,
  applyLocalDeletion,
} from './offline-store'
import { triggerSync } from './sync-manager'

const API_BASE = '/api/data'

// ─── Offline-aware fetch helpers ───

/**
 * GET with cache-then-network fallback.
 * Always returns data (from network or cache). Throws only if both fail.
 */
async function offlineGet<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      // Cache in background (don't await)
      cacheApiResponse(url, data).catch(() => {})
      return data as T
    }
    throw new Error(`HTTP ${res.status}`)
  } catch {
    // Network failed — try IndexedDB cache
    const cached = await getCachedApiResponse<T>(url)
    if (cached) return cached.data
    // No cache either — return safe defaults
    throw new Error('Offline and no cached data')
  }
}

/**
 * Safe GET that returns a default value instead of throwing.
 */
async function safeGet<T>(url: string, defaultValue: T): Promise<T> {
  try {
    return await offlineGet<T>(url)
  } catch {
    return defaultValue
  }
}

/**
 * POST with optimistic local update + sync queue.
 */
async function offlinePost(
  body: { type: string; data: unknown },
  optimistic?: { type: string; data: Record<string, unknown> },
): Promise<Response | null> {
  const jsonBody = JSON.stringify(body)

  // 1. Optimistic local update
  if (optimistic) {
    applyLocalMutation(optimistic.type, optimistic.data).catch(() => {})
  }

  // 2. Enqueue for sync
  await enqueueMutation({
    timestamp: new Date().toISOString(),
    method: 'POST',
    url: API_BASE,
    body: jsonBody,
  })

  // 3. Try immediate network push
  if (navigator.onLine) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
      })
      if (res.ok) {
        // Success — sync manager will clean the queue item on next pass
        triggerSync()
        return res
      }
    } catch {
      // Network failed — mutation is queued, will retry
    }
  }

  triggerSync()
  return null
}

/**
 * DELETE with optimistic local update + sync queue.
 */
async function offlineDelete(
  url: string,
  optimistic?: { type: string; id: string },
): Promise<void> {
  // 1. Optimistic local deletion
  if (optimistic) {
    applyLocalDeletion(optimistic.type, optimistic.id).catch(() => {})
  }

  // 2. Enqueue for sync
  await enqueueMutation({
    timestamp: new Date().toISOString(),
    method: 'DELETE',
    url,
  })

  // 3. Try immediate network push
  if (navigator.onLine) {
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        triggerSync()
        return
      }
    } catch {
      // Queued for later
    }
  }

  triggerSync()
}

// ─── User methods ───

export async function getUsers(): Promise<User[]> {
  return safeGet<User[]>(`${API_BASE}?type=users`, [])
}

export async function getUserByUsername(username: string): Promise<User | null> {
  return safeGet<User | null>(`${API_BASE}?type=user&username=${encodeURIComponent(username)}`, null)
}

export async function saveUser(user: User): Promise<void> {
  await offlinePost(
    { type: 'user', data: user },
    { type: 'user', data: user as unknown as Record<string, unknown> },
  )
}

// ─── Profile methods ───

export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  return safeGet<UserProfile | null>(`${API_BASE}?type=profile&userId=${encodeURIComponent(userId)}`, null)
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await offlinePost(
    { type: 'profile', data: profile },
    { type: 'profile', data: profile as unknown as Record<string, unknown> },
  )
}

// ─── Weight entry methods ───

export async function getWeightEntriesByUserId(userId: string): Promise<WeightEntry[]> {
  return safeGet<WeightEntry[]>(`${API_BASE}?type=weightEntries&userId=${encodeURIComponent(userId)}`, [])
}

export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  await offlinePost(
    { type: 'weightEntry', data: entry },
    { type: 'weightEntry', data: entry as unknown as Record<string, unknown> },
  )
}

// ─── Food log methods ───

export async function getFoodLogsByUserId(userId: string): Promise<FoodLog[]> {
  return safeGet<FoodLog[]>(`${API_BASE}?type=foodLogs&userId=${encodeURIComponent(userId)}`, [])
}

export async function getFoodLogsForLastDays(userId: string, days: number): Promise<FoodLog[]> {
  return safeGet<FoodLog[]>(`${API_BASE}?type=foodLogs&userId=${encodeURIComponent(userId)}&days=${days}`, [])
}

export async function saveFoodLog(log: FoodLog): Promise<void> {
  await offlinePost(
    { type: 'foodLog', data: log },
    { type: 'foodLog', data: log as unknown as Record<string, unknown> },
  )
}

export async function deleteFoodLog(logId: string): Promise<void> {
  await offlineDelete(
    `${API_BASE}?type=foodLog&id=${encodeURIComponent(logId)}`,
    { type: 'foodLog', id: logId },
  )
}

// ─── Body measurement methods ───

export async function getBodyMeasurementsByUserId(userId: string): Promise<BodyMeasurement[]> {
  return safeGet<BodyMeasurement[]>(`${API_BASE}?type=bodyMeasurements&userId=${encodeURIComponent(userId)}`, [])
}

export async function saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  await offlinePost(
    { type: 'bodyMeasurement', data: measurement },
    { type: 'bodyMeasurement', data: measurement as unknown as Record<string, unknown> },
  )
}

// ─── Saved food methods (legacy) ───

export async function getSavedFoodsByUserId(userId: string): Promise<SavedFood[]> {
  return safeGet<SavedFood[]>(`${API_BASE}?type=savedFoods&userId=${encodeURIComponent(userId)}`, [])
}

export async function saveSavedFood(food: SavedFood): Promise<void> {
  await offlinePost(
    { type: 'savedFood', data: food },
    { type: 'savedFood', data: food as unknown as Record<string, unknown> },
  )
}

export async function deleteSavedFood(foodId: string): Promise<void> {
  await offlineDelete(
    `${API_BASE}?type=savedFood&id=${encodeURIComponent(foodId)}`,
    { type: 'savedFood', id: foodId },
  )
}

// ─── Shared product catalog ───

export async function getProducts(search?: string, limit?: number): Promise<Product[]> {
  const params = new URLSearchParams({ type: 'products' })
  if (search) params.set('search', search)
  if (limit) params.set('limit', String(limit))
  return safeGet<Product[]>(`${API_BASE}?${params}`, [])
}

export async function saveProduct(product: Product): Promise<void> {
  await offlinePost(
    { type: 'product', data: product },
    { type: 'product', data: product as unknown as Record<string, unknown> },
  )
}

export interface FindOrCreateResult {
  success: boolean
  product: Product
  favorite: UserFavorite
  isNew: boolean
  wasExisting: boolean
}

/**
 * Server-side deduplication: finds an existing product by name/barcode or creates a new one.
 * Also ensures a UserFavorite link exists for the given user.
 *
 * NOTE: This endpoint requires server logic (dedup), so it cannot be fully
 * processed offline. When offline, we optimistically create both records locally
 * and queue the server call. The server will deduplicate on replay.
 */
export async function findOrCreateProduct(product: Product, userId: string): Promise<FindOrCreateResult> {
  const body = { type: 'findOrCreateProduct', data: { product, userId } }
  const jsonBody = JSON.stringify(body)

  // Try online first
  if (navigator.onLine) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
      })
      if (res.ok) {
        const result = await res.json()
        // Cache the product and favorite locally
        applyLocalMutation('product', result.product).catch(() => {})
        applyLocalMutation('userFavorite', result.favorite).catch(() => {})
        return result
      }
    } catch {
      // Fall through to offline path
    }
  }

  // Offline fallback: create optimistic records
  const favoriteId = `offline-fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const favorite: UserFavorite = {
    id: favoriteId,
    userId,
    productId: product.id,
    useCount: 1,
    lastUsed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  // Apply locally
  applyLocalMutation('product', product as unknown as Record<string, unknown>).catch(() => {})
  applyLocalMutation('userFavorite', favorite as unknown as Record<string, unknown>).catch(() => {})

  // Queue for server sync
  await enqueueMutation({
    timestamp: new Date().toISOString(),
    method: 'POST',
    url: API_BASE,
    body: jsonBody,
  })
  triggerSync()

  return {
    success: true,
    product,
    favorite,
    isNew: true,
    wasExisting: false,
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  await offlineDelete(
    `${API_BASE}?type=product&id=${encodeURIComponent(productId)}`,
    { type: 'product', id: productId },
  )
}

// ─── User favorites ───

export interface FavoriteWithProduct {
  favoriteId: string
  productId: string
  name: string
  barcode?: string
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
  useCount: number
  lastUsed: string
  createdBy: string
  isFavorite: boolean
}

export async function getUserFavoritesWithProducts(userId: string): Promise<FavoriteWithProduct[]> {
  return safeGet<FavoriteWithProduct[]>(
    `${API_BASE}?type=userFavoritesWithProducts&userId=${encodeURIComponent(userId)}`,
    [],
  )
}

export async function getUserFavorites(userId: string): Promise<UserFavorite[]> {
  return safeGet<UserFavorite[]>(`${API_BASE}?type=userFavorites&userId=${encodeURIComponent(userId)}`, [])
}

export async function saveUserFavorite(fav: UserFavorite): Promise<void> {
  await offlinePost(
    { type: 'userFavorite', data: fav },
    { type: 'userFavorite', data: fav as unknown as Record<string, unknown> },
  )
}

export async function deleteUserFavorite(favId: string): Promise<void> {
  await offlineDelete(
    `${API_BASE}?type=userFavorite&id=${encodeURIComponent(favId)}`,
    { type: 'userFavorite', id: favId },
  )
}
