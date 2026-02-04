import { promises as fs } from 'fs'
import path from 'path'
import type { User, UserProfile, WeightEntry, FoodLog, BodyMeasurement } from '@/lib/types'

interface DataStore {
  users: User[]
  profiles: UserProfile[]
  weightEntries: WeightEntry[]
  foodLogs: FoodLog[]
  bodyMeasurements: BodyMeasurement[]
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
  return { users: [], profiles: [], weightEntries: [], foodLogs: [], bodyMeasurements: [] }
}

async function readData(): Promise<DataStore> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    // Ensure all arrays exist
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      weightEntries: Array.isArray(parsed.weightEntries) ? parsed.weightEntries : [],
      foodLogs: Array.isArray(parsed.foodLogs) ? parsed.foodLogs : [],
      bodyMeasurements: Array.isArray(parsed.bodyMeasurements) ? parsed.bodyMeasurements : [],
    }
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
