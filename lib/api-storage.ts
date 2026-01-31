import type { User, UserProfile, WeightEntry, FoodLog, BodyMeasurement } from './types'

const API_BASE = '/api/data'

// User methods
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}?type=users`)
  return res.json()
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const res = await fetch(`${API_BASE}?type=user&username=${encodeURIComponent(username)}`)
  return res.json()
}

export async function saveUser(user: User): Promise<void> {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', data: user }),
  })
}

// Profile methods
export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  const res = await fetch(`${API_BASE}?type=profile&userId=${encodeURIComponent(userId)}`)
  return res.json()
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'profile', data: profile }),
  })
}

// Weight entry methods
export async function getWeightEntriesByUserId(userId: string): Promise<WeightEntry[]> {
  const res = await fetch(`${API_BASE}?type=weightEntries&userId=${encodeURIComponent(userId)}`)
  return res.json()
}

export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'weightEntry', data: entry }),
  })
}

// Food log methods
export async function getFoodLogsByUserId(userId: string): Promise<FoodLog[]> {
  const res = await fetch(`${API_BASE}?type=foodLogs&userId=${encodeURIComponent(userId)}`)
  return res.json()
}

export async function getFoodLogsForLastDays(userId: string, days: number): Promise<FoodLog[]> {
  const res = await fetch(`${API_BASE}?type=foodLogs&userId=${encodeURIComponent(userId)}&days=${days}`)
  return res.json()
}

export async function saveFoodLog(log: FoodLog): Promise<void> {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'foodLog', data: log }),
  })
}

export async function deleteFoodLog(logId: string): Promise<void> {
  await fetch(`${API_BASE}?type=foodLog&id=${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  })
}

// Body measurement methods
export async function getBodyMeasurementsByUserId(userId: string): Promise<BodyMeasurement[]> {
  const res = await fetch(`${API_BASE}?type=bodyMeasurements&userId=${encodeURIComponent(userId)}`)
  return res.json()
}

export async function saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'bodyMeasurement', data: measurement }),
  })
}
