'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BodyMeasurement } from '@/lib/types'

interface BodyFatChartProps {
  measurements: BodyMeasurement[]
  gender: 'male' | 'female'
}

export function BodyFatChart({ measurements, gender }: BodyFatChartProps) {
  // Ensure measurements is always an array
  const safeMeasurements = Array.isArray(measurements) ? measurements : []
  
  const chartData = useMemo(() => {
    return safeMeasurements.map((m) => ({
      date: new Date(m.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      bodyFat: m.bodyFatPercentage,
      fullDate: m.date,
    }))
  }, [safeMeasurements])

  // Healthy range depends on gender
  const healthyMin = gender === 'male' ? 10 : 18
  const healthyMax = gender === 'male' ? 20 : 28

  const primaryColor = '#22c55e'
  const gridColor = '#e5e7eb'

  if (safeMeasurements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Динамика процента жира</CardTitle>
          <CardDescription>
            Добавьте измерения для отображения графика
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Нет данных для отображения
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика процента жира</CardTitle>
        <CardDescription>
          Зеленая зона: здоровый диапазон ({healthyMin}% - {healthyMax}%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Процент жира']}
                labelFormatter={(label) => `Дата: ${label}`}
              />
              {/* Healthy range area */}
              <ReferenceLine y={healthyMin} stroke="#22c55e" strokeDasharray="5 5" />
              <ReferenceLine y={healthyMax} stroke="#22c55e" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="bodyFat"
                stroke={primaryColor}
                strokeWidth={3}
                dot={{ fill: primaryColor, strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, fill: primaryColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
