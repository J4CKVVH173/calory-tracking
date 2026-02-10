import { promises as fs } from 'fs'
import path from 'path'
import type { User, UserProfile, WeightEntry, FoodLog, BodyMeasurement, SavedFood, Product, UserFavorite } from '@/lib/types'

interface DataStore {
  users: User[]
  profiles: UserProfile[]
  weightEntries: WeightEntry[]
  foodLogs: FoodLog[]
  bodyMeasurements: BodyMeasurement[]
  savedFoods: SavedFood[] // legacy, kept for backward compat
  products: Product[]
  userFavorites: UserFavorite[]
}

const DATA_FILE = path.join(process.cwd(), 'data', 'store.json')
const LOCK_FILE = path.join(process.cwd(), 'data', '.lock')

// Simple file-based mutex to prevent race conditions
let writeLock: Promise<void> = Promise.resolve()

async function acquireLock(): Promise<() => void> {
  let releaseFn: () => void = () => {}
  const newLock = new Promise<void>((resolve) => {
    releaseFn = resolve
  })
  
  const previousLock = writeLock
  writeLock = newLock
  
  await previousLock
  return releaseFn
}

async function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

function getEmptyStore(): DataStore {
  return { users: [], profiles: [], weightEntries: [], foodLogs: [], bodyMeasurements: [], savedFoods: [], products: [], userFavorites: [] }
}

async function readData(): Promise<DataStore> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    // Ensure all arrays exist
    const store: DataStore = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      weightEntries: Array.isArray(parsed.weightEntries) ? parsed.weightEntries : [],
      foodLogs: Array.isArray(parsed.foodLogs) ? parsed.foodLogs : [],
      bodyMeasurements: Array.isArray(parsed.bodyMeasurements) ? parsed.bodyMeasurements : [],
      savedFoods: Array.isArray(parsed.savedFoods) ? parsed.savedFoods : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      userFavorites: Array.isArray(parsed.userFavorites) ? parsed.userFavorites : [],
    }
    
    // Auto-migrate: convert legacy savedFoods into products + userFavorites
    if (store.savedFoods.length > 0 && store.products.length === 0) {
      for (const sf of store.savedFoods) {
        // Check if product already exists by name+barcode
        let product = store.products.find(p => 
          p.name.toLowerCase() === sf.name.toLowerCase() && 
          (p.barcode === sf.barcode || (!p.barcode && !sf.barcode))
        )
        if (!product) {
          product = {
            id: sf.id, // reuse ID for simplicity
            name: sf.name,
            barcode: sf.barcode,
            weight: sf.weight,
            calories: sf.calories,
            protein: sf.protein,
            fat: sf.fat,
            carbs: sf.carbs,
            createdBy: sf.userId,
            createdAt: sf.createdAt,
          }
          store.products.push(product)
        }
        // Create favorite link
        store.userFavorites.push({
          id: crypto.randomUUID(),
          userId: sf.userId,
          productId: product.id,
          customWeight: undefined,
          useCount: sf.useCount,
          lastUsed: sf.lastUsed,
          createdAt: sf.createdAt,
        })
      }
      store.savedFoods = [] // Clear legacy data after migration
      // Write migrated data immediately
      await writeData(store)
    }
    
    return store
  } catch (error) {
    console.error('[v0] Error reading data file:', error)
    return getEmptyStore()
  }
}

async function writeData(data: DataStore): Promise<void> {
  await ensureDataDir()
  // Validate data before writing
  const validData: DataStore = {
    users: Array.isArray(data.users) ? data.users : [],
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    weightEntries: Array.isArray(data.weightEntries) ? data.weightEntries : [],
    foodLogs: Array.isArray(data.foodLogs) ? data.foodLogs : [],
    bodyMeasurements: Array.isArray(data.bodyMeasurements) ? data.bodyMeasurements : [],
    savedFoods: Array.isArray(data.savedFoods) ? data.savedFoods : [],
    products: Array.isArray(data.products) ? data.products : [],
    userFavorites: Array.isArray(data.userFavorites) ? data.userFavorites : [],
  }
  // Write to temp file first, then rename for atomic operation
  const tempFile = DATA_FILE + '.tmp'
  await fs.writeFile(tempFile, JSON.stringify(validData, null, 2), 'utf-8')
  await fs.rename(tempFile, DATA_FILE)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const userId = searchParams.get('userId')

  const data = await readData()

  switch (type) {
    case 'users':
      return Response.json(data.users)
    case 'user':
      const username = searchParams.get('username')
      const user = data.users.find(u => u.username === username)
      return Response.json(user || null)
    case 'profile':
      if (!userId) return Response.json(null)
      const profile = data.profiles.find(p => p.userId === userId)
      return Response.json(profile || null)
    case 'weightEntries':
      if (!userId) return Response.json([])
      const weightEntries = data.weightEntries
        .filter(w => w.userId === userId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return Response.json(weightEntries)
    case 'foodLogs':
      if (!userId) return Response.json([])
      const days = searchParams.get('days')
      let foodLogs = data.foodLogs
        .filter(f => f.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      if (days) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - parseInt(days))
        foodLogs = foodLogs.filter(log => new Date(log.date) >= cutoff)
      }
      return Response.json(foodLogs)
    case 'bodyMeasurements':
      if (!userId) return Response.json([])
      const bodyMeasurements = data.bodyMeasurements
        .filter(m => m.userId === userId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return Response.json(bodyMeasurements)
    case 'savedFoods':
      if (!userId) return Response.json([])
      const savedFoods = data.savedFoods
        .filter(f => f.userId === userId)
        .sort((a, b) => b.useCount - a.useCount) // Most used first
      return Response.json(savedFoods)
    case 'products':
      // Return all products (shared catalog), optionally filter by search
      const productSearch = searchParams.get('search')
      let products = [...data.products]
      if (productSearch) {
        const term = productSearch.toLowerCase()
        products = products.filter(p => 
          p.name.toLowerCase().includes(term) || 
          (p.barcode && p.barcode.includes(term))
        )
      }
      return Response.json(products)
    case 'userFavorites':
      if (!userId) return Response.json([])
      const favorites = data.userFavorites
        .filter(f => f.userId === userId)
        .sort((a, b) => b.useCount - a.useCount)
      return Response.json(favorites)
    case 'userFavoritesWithProducts':
      // Join favorites with product data for the current user
      if (!userId) return Response.json([])
      const userFavs = data.userFavorites.filter(f => f.userId === userId)
      const joined = userFavs
        .map(fav => {
          const product = data.products.find(p => p.id === fav.productId)
          if (!product) return null
          return {
            favoriteId: fav.id,
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            weight: fav.customWeight || product.weight,
            calories: product.calories,
            protein: product.protein,
            fat: product.fat,
            carbs: product.carbs,
            useCount: fav.useCount,
            lastUsed: fav.lastUsed,
            createdBy: product.createdBy,
            isFavorite: true,
          }
        })
        .filter(Boolean)
        .sort((a, b) => (b?.useCount ?? 0) - (a?.useCount ?? 0))
      return Response.json(joined)
    default:
      return Response.json(data)
  }
}

export async function POST(request: Request) {
  const release = await acquireLock()
  
  try {
    const { type, data: newData } = await request.json()
    const store = await readData()

    switch (type) {
      case 'user': {
        const user = newData as User
        const existingIndex = store.users.findIndex(u => u.id === user.id)
        if (existingIndex >= 0) {
          // Merge with existing data to prevent field loss
          store.users[existingIndex] = { ...store.users[existingIndex], ...user }
        } else {
          store.users.push(user)
        }
        break
      }
      case 'profile': {
        const profile = newData as UserProfile
        const existingIndex = store.profiles.findIndex(p => p.userId === profile.userId)
        if (existingIndex >= 0) {
          // Merge with existing data to prevent field loss
          store.profiles[existingIndex] = { ...store.profiles[existingIndex], ...profile }
        } else {
          store.profiles.push(profile)
        }
        break
      }
      case 'weightEntry': {
        const entry = newData as WeightEntry
        const existingIndex = store.weightEntries.findIndex(e => e.id === entry.id)
        if (existingIndex >= 0) {
          store.weightEntries[existingIndex] = { ...store.weightEntries[existingIndex], ...entry }
        } else {
          store.weightEntries.push(entry)
        }
        break
      }
      case 'foodLog': {
        const log = newData as FoodLog
        const existingIndex = store.foodLogs.findIndex(l => l.id === log.id)
        if (existingIndex >= 0) {
          store.foodLogs[existingIndex] = { ...store.foodLogs[existingIndex], ...log }
        } else {
          store.foodLogs.push(log)
        }
        break
      }
      case 'bodyMeasurement': {
        const measurement = newData as BodyMeasurement
        const existingIndex = store.bodyMeasurements.findIndex(m => m.id === measurement.id)
        if (existingIndex >= 0) {
          store.bodyMeasurements[existingIndex] = { ...store.bodyMeasurements[existingIndex], ...measurement }
        } else {
          store.bodyMeasurements.push(measurement)
        }
        break
      }
      case 'savedFood': {
        const food = newData as SavedFood
        const existingIndex = store.savedFoods.findIndex(f => f.id === food.id)
        if (existingIndex >= 0) {
          store.savedFoods[existingIndex] = { ...store.savedFoods[existingIndex], ...food }
        } else {
          store.savedFoods.push(food)
        }
        break
      }
      case 'product': {
        const product = newData as Product
        const existingIndex = store.products.findIndex(p => p.id === product.id)
        if (existingIndex >= 0) {
          store.products[existingIndex] = { ...store.products[existingIndex], ...product }
        } else {
          store.products.push(product)
        }
        break
      }
      case 'userFavorite': {
        const fav = newData as UserFavorite
        const existingIndex = store.userFavorites.findIndex(f => f.id === fav.id)
        if (existingIndex >= 0) {
          store.userFavorites[existingIndex] = { ...store.userFavorites[existingIndex], ...fav }
        } else {
          store.userFavorites.push(fav)
        }
        break
      }
      case 'findOrCreateProduct': {
        // Server-side deduplication: find existing product by normalized name
        // or barcode, or create a new one. Also ensures a UserFavorite link exists.
        const { product: incoming, userId } = newData as { product: Product; userId: string }
        const normName = incoming.name.trim().toLowerCase()
        
        // 1. Find by barcode first (strongest match)
        let existing: Product | undefined
        if (incoming.barcode) {
          existing = store.products.find(p => p.barcode && p.barcode === incoming.barcode)
        }
        // 2. Fall back to normalized name match
        if (!existing) {
          existing = store.products.find(p => p.name.trim().toLowerCase() === normName)
        }
        
        let product: Product
        let isNew = false
        if (existing) {
          product = existing
        } else {
          product = { ...incoming, id: incoming.id || crypto.randomUUID() }
          store.products.push(product)
          isNew = true
        }
        
        // Ensure UserFavorite link exists for this user
        let favorite = store.userFavorites.find(
          f => f.userId === userId && f.productId === product.id
        )
        if (favorite) {
          // Bump use count
          favorite.useCount += 1
          favorite.lastUsed = new Date().toISOString()
        } else {
          favorite = {
            id: crypto.randomUUID(),
            userId,
            productId: product.id,
            useCount: 1,
            lastUsed: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }
          store.userFavorites.push(favorite)
        }
        
        await writeData(store)
        release()
        return Response.json({ 
          success: true, 
          product, 
          favorite, 
          isNew,
          wasExisting: !isNew,
        })
      }
    }

    await writeData(store)
    return Response.json({ success: true })
  } catch (error) {
    console.error('[v0] Error in POST:', error)
    return Response.json({ error: 'Failed to save data' }, { status: 500 })
  } finally {
    release()
  }
}

export async function DELETE(request: Request) {
  const release = await acquireLock()
  
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return Response.json({ error: 'Missing type or id' }, { status: 400 })
    }

    const store = await readData()

    switch (type) {
      case 'foodLog':
        store.foodLogs = store.foodLogs.filter(l => l.id !== id)
        break
      case 'savedFood':
        store.savedFoods = store.savedFoods.filter(f => f.id !== id)
        break
      case 'product':
        store.products = store.products.filter(p => p.id !== id)
        // Also remove all favorites referencing this product
        store.userFavorites = store.userFavorites.filter(f => f.productId !== id)
        break
      case 'userFavorite':
        store.userFavorites = store.userFavorites.filter(f => f.id !== id)
        break
    }

    await writeData(store)
    return Response.json({ success: true })
  } catch (error) {
    console.error('[v0] Error in DELETE:', error)
    return Response.json({ error: 'Failed to delete data' }, { status: 500 })
  } finally {
    release()
  }
}
