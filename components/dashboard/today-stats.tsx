'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { FoodLog, UserProfile } from '@/lib/types'
import { Flame, Beef, Droplet, Cookie } from 'lucide-react'

interface TodayStatsProps {
  logs: FoodLog[]
  profile: UserProfile | undefined
}

export function TodayStats({ logs, profile }: TodayStatsProps) {
  const today = new Date().toISOString().split('T')[0]
  const todayLogs = logs.filter((log) => log.date === today)

  const totals = todayLogs.reduce(
    (acc, log) => {
      log.items.forEach((item) => {
        acc.calories += item.calories
        acc.protein += item.protein
        acc.fat += item.fat
        acc.carbs += item.carbs
      })
      return acc
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  )

  // Extract target calories from AI plan if available
  let targetCalories = 2000 // Default
  if (profile?.aiPlan) {
    const match = profile.aiPlan.match(/(\d{4})\s*(ккал|калор)/i)
    if (match) {
      targetCalories = Number.parseInt(match[1])
    }
  }

  const calorieProgress = Math.min((totals.calories / targetCalories) * 100, 100)

  const stats = [
    {
      label: 'Калории',
      value: totals.calories,
      unit: 'ккал',
      target: targetCalories,
      icon: Flame,
      color: 'text-orange-500',
    },
    {
      label: 'Белки',
      value: totals.protein.toFixed(1),
      unit: 'г',
      icon: Beef,
      color: 'text-red-500',
    },
    {
      label: 'Жиры',
      value: totals.fat.toFixed(1),
      unit: 'г',
      icon: Droplet,
      color: 'text-yellow-500',
    },
    {
      label: 'Углеводы',
      value: totals.carbs.toFixed(1),
      unit: 'г',
      icon: Cookie,
      color: 'text-blue-500',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сегодня</CardTitle>
        <CardDescription>
          Ваши текущие показатели за{' '}
          {new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Калории</span>
            <span className="font-medium">
              {totals.calories} / {targetCalories} ккал
            </span>
          </div>
          <Progress value={calorieProgress} className="h-3" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
              >
                <Icon className={`h-5 w-5 mb-1 ${stat.color}`} />
                <span className="text-lg font-bold">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.unit}</span>
              </div>
            )
          })}
        </div>

        {todayLogs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Записей за сегодня пока нет
          </p>
        )}
      </CardContent>
    </Card>
  )
}
