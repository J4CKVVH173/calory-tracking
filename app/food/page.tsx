'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FoodInput } from '@/components/food/food-input'
import { FoodLogList } from '@/components/food/food-log-list'
import { useAuth } from '@/lib/auth-context'
import { getFoodLogsByUserId } from '@/lib/api-storage'
import type { FoodLog } from '@/lib/types'
import { Loader2 } from 'lucide-react'

export default function FoodPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const loadLogs = useCallback(async () => {
    if (user) {
      const userLogs = await getFoodLogsByUserId(user.id)
      setLogs(userLogs)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    loadLogs()
  }, [loadLogs, refreshKey])

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <FoodInput onFoodAdded={handleRefresh} />
      <FoodLogList logs={logs} onDelete={handleRefresh} />
    </div>
  )
}
