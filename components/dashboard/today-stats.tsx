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

  // Use nutrition goals from profile, fallback to defaults
  const goals = profile?.nutritionGoals || {
    calories: 2000,
    protein: 150,
    fat: 65,
    carbs: 250,
  }

  const macros = [
    {
      label: 'Калории',
      current: Math.round(totals.calories),
      target: goals.calories,
      unit: 'ккал',
      icon: Flame,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-600',
    },
    {
      label: 'Белки',
      current: Math.round(totals.protein),
      target: goals.protein,
      unit: 'г',
      icon: Beef,
      color: 'bg-red-500',
      bgColor: 'bg-red-500/20',
      textColor: 'text-red-600',
    },
    {
      label: 'Жиры',
      current: Math.round(totals.fat),
      target: goals.fat,
      unit: 'г',
      icon: Droplet,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-600',
    },
    {
      label: 'Углеводы',
      current: Math.round(totals.carbs),
      target: goals.carbs,
      unit: 'г',
      icon: Cookie,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-600',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сегодня</CardTitle>
        <CardDescription>
          Ваши показатели за{' '}
          {new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {macros.map((macro) => {
            const Icon = macro.icon
            const progress = Math.min((macro.current / macro.target) * 100, 100)
            const remaining = macro.target - macro.current
            const isOver = remaining < 0

            return (
              <div
                key={macro.label}
                className={`p-3 sm:p-4 rounded-xl ${macro.bgColor}`}
              >
                {/* Mobile: horizontal row layout */}
                <div className="flex items-center gap-3 sm:hidden">
                  <div className={`rounded-full p-2 bg-background/30 shrink-0`}>
                    <Icon className={`h-5 w-5 ${macro.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={`text-sm font-medium ${macro.textColor}`}>{macro.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {isOver ? (
                          <span className="text-destructive font-medium">
                            +{Math.abs(remaining)} {macro.unit}
                          </span>
                        ) : remaining === 0 ? (
                          <span className="text-primary font-medium">Цель!</span>
                        ) : (
                          <span>-{remaining} {macro.unit}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className={`text-2xl font-bold ${macro.textColor}`}>
                        {macro.current}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {macro.target} {macro.unit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${macro.color}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop: original stacked layout */}
                <div className="hidden sm:block">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-5 w-5 ${macro.textColor}`} />
                    <span className={`text-sm font-medium ${macro.textColor}`}>{macro.label}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className={`text-2xl font-bold ${macro.textColor}`}>
                        {macro.current}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {macro.target} {macro.unit}
                      </span>
                    </div>
                    
                    <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${macro.color}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {isOver ? (
                        <span className="text-destructive font-medium">
                          Превышено на {Math.abs(remaining)} {macro.unit}
                        </span>
                      ) : remaining === 0 ? (
                        <span className="text-primary font-medium">Цель достигнута!</span>
                      ) : (
                        <span>Осталось: {remaining} {macro.unit}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {todayLogs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Записей за сегодня пока нет. Добавьте еду в разделе Питание.
          </p>
        )}

        {!profile?.nutritionGoals && (
          <p className="text-sm text-muted-foreground text-center py-2 bg-muted/50 rounded-lg">
            Заполните профиль и получите план от AI для персональных целей питания.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
