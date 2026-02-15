'use client'

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { FoodLog } from '@/lib/types'

interface CalorieChartProps {
  logs: FoodLog[]
}

export function CalorieChart({ logs }: CalorieChartProps) {
  // Group logs by date and sum calories
  const caloriesByDate = logs.reduce((acc, log) => {
    const date = log.date
    const calories = log.items.reduce((sum, item) => sum + item.calories, 0)
    acc[date] = (acc[date] || 0) + calories
    return acc
  }, {} as Record<string, number>)

  // Get last 7 days
  const today = new Date()
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    chartData.push({
      date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }),
      calories: caloriesByDate[dateStr] || 0,
    })
  }

  const maxCalories = Math.max(...chartData.map((d) => d.calories), 1)

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Калории за неделю</CardTitle>
          <CardDescription>Ежедневное потребление калорий</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            Нет записей о питании. Добавьте первую запись на странице Питание.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Калории за неделю</CardTitle>
        <CardDescription>Ежедневное потребление калорий</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            calories: {
              label: 'Калории',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-[200px] w-full"
        >
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, maxCalories + 200]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="calories"
              fill="var(--color-calories)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
