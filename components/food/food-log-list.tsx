'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { FoodLog } from '@/lib/types'
import { deleteFoodLog } from '@/lib/api-storage'
import { Trash2, Utensils } from 'lucide-react'

interface FoodLogListProps {
  logs: FoodLog[]
  onDelete: () => void
}

export function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  const handleDelete = async (logId: string) => {
    await deleteFoodLog(logId)
    onDelete()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const groupedLogs = logs.reduce((acc, log) => {
    const date = log.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(log)
    return acc
  }, {} as Record<string, FoodLog[]>)

  const sortedDates = Object.keys(groupedLogs).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Записей о питании пока нет</p>
          <p className="text-sm text-muted-foreground mt-1">
            Добавьте первую запись выше
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const dayLogs = groupedLogs[date]
        const dayCalories = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.calories, 0),
          0
        )
        const dayProtein = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.protein, 0),
          0
        )
        const dayFat = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.fat, 0),
          0
        )
        const dayCarbs = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.carbs, 0),
          0
        )

        return (
          <Card key={date} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {new Date(date).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </CardTitle>
                  <CardDescription>
                    Всего: {dayCalories} ккал | Б: {dayProtein.toFixed(1)}г | Ж: {dayFat.toFixed(1)}г | У: {dayCarbs.toFixed(1)}г
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dayLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-2">
                        {formatDate(log.createdAt)}
                      </p>
                      <p className="text-sm italic mb-2 text-muted-foreground">
                        {'"'}{log.rawInput}{'"'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(log.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {log.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                      >
                        <span>{item.name} ({item.weight}г)</span>
                        <span className="font-medium">{item.calories} ккал</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
