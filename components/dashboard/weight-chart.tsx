'use client'

import { useMemo } from 'react'
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
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
import type { WeightEntry, UserProfile } from '@/lib/types'

interface WeightChartProps {
  entries: WeightEntry[]
  profile?: UserProfile
}

export function WeightChart({ entries, profile }: WeightChartProps) {
  const chartData = useMemo(() => {
    // If we have weight entries, use them
    if (entries.length > 0) {
      return entries.map((entry) => ({
        date: new Date(entry.date).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        }),
        weight: entry.weight,
      }))
    }
    
    // If no entries but we have profile weight, show it as starting point
    if (profile?.weight) {
      return [{
        date: profile.updatedAt 
          ? new Date(profile.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          : new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        weight: profile.weight,
      }]
    }
    
    return []
  }, [entries, profile])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Динамика веса</CardTitle>
          <CardDescription>Отслеживание изменений веса</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            Нет данных о весе. Заполните профиль для начала отслеживания.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика веса</CardTitle>
        <CardDescription>Отслеживание изменений веса в кг</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            weight: {
              label: 'Вес (кг)',
              color: 'hsl(var(--chart-1))',
            },
          }}
          className="h-[200px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--color-weight)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-weight)', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
