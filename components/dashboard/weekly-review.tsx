'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { FoodLog, UserProfile } from '@/lib/types'
import { Loader2, Sparkles } from 'lucide-react'

interface WeeklyReviewProps {
  logs: FoodLog[]
  profile: UserProfile | undefined
}

export function WeeklyReview({ logs, profile }: WeeklyReviewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get last 7 days of logs
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const weeklyLogs = logs.filter((log) => new Date(log.date) >= cutoff)

  const handleGetRecommendation = async () => {
    if (!profile) {
      setError('Пожалуйста, заполните профиль для получения рекомендаций')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: weeklyLogs,
          profile,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recommendation')
      }

      setRecommendation(data.recommendation)
    } catch {
      setError('Не удалось получить рекомендацию. Попробуйте позже.')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate weekly totals
  const weeklyTotals = weeklyLogs.reduce(
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

  const avgCalories = weeklyLogs.length > 0 ? Math.round(weeklyTotals.calories / 7) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Недельный обзор
        </CardTitle>
        <CardDescription>
          Получите персональные рекомендации на основе вашего питания за неделю
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground">Записей за неделю</div>
            <div className="text-xl font-bold">{weeklyLogs.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground">Среднее в день</div>
            <div className="text-xl font-bold">{avgCalories} ккал</div>
          </div>
        </div>

        {weeklyLogs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 rounded bg-secondary/50">
              <div className="text-xs text-muted-foreground">Белки</div>
              <div className="font-medium">{weeklyTotals.protein.toFixed(0)}г</div>
            </div>
            <div className="p-2 rounded bg-secondary/50">
              <div className="text-xs text-muted-foreground">Жиры</div>
              <div className="font-medium">{weeklyTotals.fat.toFixed(0)}г</div>
            </div>
            <div className="p-2 rounded bg-secondary/50">
              <div className="text-xs text-muted-foreground">Углеводы</div>
              <div className="font-medium">{weeklyTotals.carbs.toFixed(0)}г</div>
            </div>
          </div>
        )}

        <Button
          onClick={handleGetRecommendation}
          disabled={isLoading || weeklyLogs.length === 0}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализирую...
            </>
          ) : (
            'Получить рекомендацию за неделю'
          )}
        </Button>

        {weeklyLogs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Добавьте записи о питании для получения рекомендаций
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
            {error}
          </p>
        )}

        {recommendation && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Рекомендации ИИ
            </h4>
            <div className="text-sm whitespace-pre-wrap">{recommendation}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
