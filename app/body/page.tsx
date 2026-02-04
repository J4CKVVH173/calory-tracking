'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getProfileByUserId, getBodyMeasurementsByUserId } from '@/lib/api-storage'
import type { BodyMeasurement, UserProfile } from '@/lib/types'
import { MeasurementForm } from '@/components/body/measurement-form'
import { BodyFatChart } from '@/components/body/body-fat-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react'

export default function BodyPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      const [profileData, measurementsData] = await Promise.all([
        getProfileByUserId(user.id),
        getBodyMeasurementsByUserId(user.id),
      ])
      
      setProfile(profileData)
      // Ensure measurements is always an array
      setMeasurements(Array.isArray(measurementsData) ? measurementsData : [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
      return
    }
    
    if (user) {
      loadData()
    }
  }, [user, authLoading, router, loadData])

  // Refresh data when page gains focus (e.g., navigating back from dashboard)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        loadData()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Also refresh on visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        loadData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, loadData])

  if (authLoading || isLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user) return null

  const latestMeasurement = measurements.length > 0 
    ? measurements[measurements.length - 1] 
    : null
  
  const previousMeasurement = measurements.length > 1 
    ? measurements[measurements.length - 2] 
    : null

  const fatDifference = latestMeasurement && previousMeasurement
    ? latestMeasurement.bodyFatPercentage - previousMeasurement.bodyFatPercentage
    : null

  const gender = profile?.gender || 'male'

  // Reference ranges
  const getReferenceData = () => {
    if (gender === 'male') {
      return [
        { category: 'Необходимый жир', range: '2-5%' },
        { category: 'Атлеты', range: '6-13%' },
        { category: 'Фитнес', range: '14-17%' },
        { category: 'Норма', range: '18-24%' },
        { category: 'Избыток', range: '25%+' },
      ]
    } else {
      return [
        { category: 'Необходимый жир', range: '10-13%' },
        { category: 'Атлеты', range: '14-20%' },
        { category: 'Фитнес', range: '21-24%' },
        { category: 'Норма', range: '25-31%' },
        { category: 'Избыток', range: '32%+' },
      ]
    }
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance">Состав тела</h1>
        <p className="text-muted-foreground mt-2">
          Отслеживайте процент подкожного жира и следите за прогрессом
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Form and Reference */}
        <div className="space-y-6">
          <MeasurementForm onMeasurementSaved={loadData} />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Справочные значения
              </CardTitle>
              <CardDescription>
                Категории процента жира для {gender === 'male' ? 'мужчин' : 'женщин'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getReferenceData().map((item, index) => (
                  <div 
                    key={index}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.range}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Current Stats */}
        <div className="space-y-6">
          {latestMeasurement ? (
            <>
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardHeader>
                  <CardTitle>Текущий процент жира</CardTitle>
                  <CardDescription>
                    Измерение от {new Date(latestMeasurement.date).toLocaleDateString('ru-RU')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-4">
                    <div className="text-6xl font-bold text-primary">
                      {latestMeasurement.bodyFatPercentage.toFixed(1)}%
                    </div>
                    {fatDifference !== null && (
                      <div className="pb-2 flex items-center gap-1 text-sm">
                        {fatDifference < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">
                              {Math.abs(fatDifference).toFixed(1)}%
                            </span>
                          </>
                        ) : fatDifference > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-red-500" />
                            <span className="text-red-500 font-medium">
                              +{fatDifference.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              0%
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold">{latestMeasurement.weight} кг</div>
                    <p className="text-sm text-muted-foreground mt-1">Вес</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold">{latestMeasurement.height} см</div>
                    <p className="text-sm text-muted-foreground mt-1">Рост</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold">{latestMeasurement.waist} см</div>
                    <p className="text-sm text-muted-foreground mt-1">Талия</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold">{latestMeasurement.neck} см</div>
                    <p className="text-sm text-muted-foreground mt-1">Шея</p>
                  </CardContent>
                </Card>
                {latestMeasurement.hips && (
                  <Card className="col-span-2">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold">{latestMeasurement.hips} см</div>
                      <p className="text-sm text-muted-foreground mt-1">Бедра</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-2">Всего измерений</div>
                  <div className="text-2xl font-bold">{measurements.length}</div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium">Нет данных</p>
                  <p className="text-sm mt-1">Введите измерения в форме слева</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Chart - Full Width */}
      <div className="mt-6">
        <BodyFatChart measurements={measurements} gender={gender} />
      </div>
    </div>
  )
}
