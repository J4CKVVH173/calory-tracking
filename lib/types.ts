export interface User {
  id: string
  username: string
  passwordHash: string
  createdAt: string
}

export interface NutritionGoals {
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface UserProfile {
  userId: string
  age: number
  gender: 'male' | 'female'
  weight: number
  height: number
  goal: string
  lifestyle: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  aiPlan?: string
  nutritionGoals?: NutritionGoals
  updatedAt: string
}

export interface WeightEntry {
  id: string
  userId: string
  weight: number
  date: string
}

export interface FoodItem {
  name: string
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
  quantity?: number // multiplier for portions, default 1
}

export interface FoodLog {
  id: string
  userId: string
  items: FoodItem[]
  rawInput: string
  date: string
  createdAt: string
}

export type LifestyleOption = {
  value: UserProfile['lifestyle']
  label: string
  description: string
}

export const lifestyleOptions: LifestyleOption[] = [
  { value: 'sedentary', label: 'Сидячий', description: 'Офисная работа, минимум движения, без тренировок' },
  { value: 'light', label: 'Легкая активность', description: 'Прогулки 1-2 раза в неделю, легкая работа по дому' },
  { value: 'moderate', label: 'Умеренная активность', description: 'Тренировки 3-4 раза в неделю, активные прогулки' },
  { value: 'active', label: 'Активный', description: 'Ежедневные тренировки, физическая работа' },
  { value: 'very_active', label: 'Очень активный', description: 'Интенсивные тренировки 2 раза в день или тяжелый физический труд' },
]

export const genderOptions = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
] as const

export interface BodyMeasurement {
  id: string
  userId: string
  weight: number
  height: number
  waist: number
  neck: number
  hips?: number // Required for women
  bodyFatPercentage: number
  date: string
  createdAt: string
}

// Saved food item for user's personal food database
// Macros (calories, protein, fat, carbs) are always stored PER 100g.
// `weight` is the default serving size in grams (e.g. 120g for a yogurt).
export interface SavedFood {
  id: string
  userId: string
  name: string
  barcode?: string // EAN/UPC barcode
  weight: number // default serving size in grams
  calories: number // per 100g
  protein: number // per 100g
  fat: number // per 100g
  carbs: number // per 100g
  useCount: number // track frequency for sorting suggestions
  lastUsed: string
  createdAt: string
}
