'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getProfileByUserId, getFoodLogsByUserId, getWeightEntriesByUserId } from '@/lib/api-storage'
import type { UserProfile, FoodLog, WeightEntry } from '@/lib/types'
import { WeightChart } from '@/components/dashboard/weight-chart'
import { CalorieChart } from '@/components/dashboard/calorie-chart'
import { TodayStats } from '@/components/dashboard/today-stats'
import { WeeklyReview } from '@/components/dashboard/weekly-review'
import { AddWeight } from '@/components/dashboard/add-weight'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, User, Utensils, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | undefined>()
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    if (user) {
      const [profileData, logsData, weightData] = await Promise.all([
        getProfileByUserId(user.id),
        getFoodLogsByUserId(user.id),
        getWeightEntriesByUserId(user.id),
      ])
      setProfile(profileData ?? undefined)
      setFoodLogs(logsData)
      setWeightEntries(weightData)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const hasProfile = !!profile
  const hasFoodLogs = foodLogs.length > 0

  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-8 max-w-4xl space-y-3 sm:space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            Привет, {user.username}!
          </h1>
          <p className="text-muted-foreground">
            Отслеживайте ваше питание и достигайте целей
          </p>
        </div>
        <AddWeight onWeightAdded={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Quick actions if missing profile or food logs */}
      {(!hasProfile || !hasFoodLogs) && (
        <div className="grid gap-2 sm:gap-4 sm:grid-cols-2">
          {!hasProfile && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Заполните профиль
                </CardTitle>
                <CardDescription>
                  Получите персональный план питания от ИИ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/profile">
                  <Button className="w-full h-12 text-base sm:h-10 sm:text-sm">
                    Заполнить профиль
                    <ArrowRight className="ml-2 h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {!hasFoodLogs && (
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Utensils className="h-5 w-5" />
                  Добавьте первую запись
                </CardTitle>
                <CardDescription>
                  Начните отслеживать ваше питание
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/food">
                  <Button variant="secondary" className="w-full h-12 text-base sm:h-10 sm:text-sm">
                    Добавить еду
                    <ArrowRight className="ml-2 h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Today's stats */}
      <TodayStats logs={foodLogs} profile={profile} />

      {/* Charts */}
      <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
        <CalorieChart logs={foodLogs} />
        <WeightChart entries={weightEntries} profile={profile} />
      </div>

      {/* Weekly review */}
      <WeeklyReview logs={foodLogs} profile={profile} />
    </div>
  )
}
