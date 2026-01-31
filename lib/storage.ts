import type { User, UserProfile, WeightEntry, FoodLog } from './types'

const STORAGE_KEYS = {
  USERS: 'calorie_tracker_users',
  PROFILES: 'calorie_tracker_profiles',
  WEIGHT_ENTRIES: 'calorie_tracker_weight_entries',
  FOOD_LOGS: 'calorie_tracker_food_logs',
  CURRENT_USER: 'calorie_tracker_current_user',
} as const

function getItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const item = localStorage.getItem(key)
  return item ? JSON.parse(item) : null
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

// User methods
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.USERS) || []
}

export function getUserByUsername(username: string): User | undefined {
  return getUsers().find((u) => u.username === username)
}

export function saveUser(user: User): void {
  const users = getUsers()
  const existingIndex = users.findIndex((u) => u.id === user.id)
  if (existingIndex >= 0) {
    users[existingIndex] = user
  } else {
    users.push(user)
  }
  setItem(STORAGE_KEYS.USERS, users)
}

// Current user session
export function getCurrentUserId(): string | null {
  return getItem<string>(STORAGE_KEYS.CURRENT_USER)
}

export function setCurrentUserId(userId: string | null): void {
  if (userId) {
    setItem(STORAGE_KEYS.CURRENT_USER, userId)
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }
}

// Profile methods
export function getProfiles(): UserProfile[] {
  return getItem<UserProfile[]>(STORAGE_KEYS.PROFILES) || []
}

export function getProfileByUserId(userId: string): UserProfile | undefined {
  return getProfiles().find((p) => p.userId === userId)
}

export function saveProfile(profile: UserProfile): void {
  const profiles = getProfiles()
  const existingIndex = profiles.findIndex((p) => p.userId === profile.userId)
  if (existingIndex >= 0) {
    profiles[existingIndex] = profile
  } else {
    profiles.push(profile)
  }
  setItem(STORAGE_KEYS.PROFILES, profiles)
}

// Weight entry methods
export function getWeightEntries(): WeightEntry[] {
  return getItem<WeightEntry[]>(STORAGE_KEYS.WEIGHT_ENTRIES) || []
}

export function getWeightEntriesByUserId(userId: string): WeightEntry[] {
  return getWeightEntries()
    .filter((w) => w.userId === userId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function saveWeightEntry(entry: WeightEntry): void {
  const entries = getWeightEntries()
  const existingIndex = entries.findIndex((e) => e.id === entry.id)
  if (existingIndex >= 0) {
    entries[existingIndex] = entry
  } else {
    entries.push(entry)
  }
  setItem(STORAGE_KEYS.WEIGHT_ENTRIES, entries)
}

// Food log methods
export function getFoodLogs(): FoodLog[] {
  return getItem<FoodLog[]>(STORAGE_KEYS.FOOD_LOGS) || []
}

export function getFoodLogsByUserId(userId: string): FoodLog[] {
  return getFoodLogs()
    .filter((f) => f.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getFoodLogsForLastDays(userId: string, days: number): FoodLog[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return getFoodLogsByUserId(userId).filter(
    (log) => new Date(log.date) >= cutoff
  )
}

export function saveFoodLog(log: FoodLog): void {
  const logs = getFoodLogs()
  const existingIndex = logs.findIndex((l) => l.id === log.id)
  if (existingIndex >= 0) {
    logs[existingIndex] = log
  } else {
    logs.push(log)
  }
  setItem(STORAGE_KEYS.FOOD_LOGS, logs)
}

export function deleteFoodLog(logId: string): void {
  const logs = getFoodLogs().filter((l) => l.id !== logId)
  setItem(STORAGE_KEYS.FOOD_LOGS, logs)
}
