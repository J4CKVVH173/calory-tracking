'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { getProfileByUserId, getWeightEntriesByUserId, saveBodyMeasurement } from '@/lib/api-storage'
import type { BodyMeasurement, UserProfile } from '@/lib/types'
import { Loader2, Calculator, Save, RefreshCw } from 'lucide-react'

interface MeasurementFormProps {
  onMeasurementSaved: () => void
}

export function MeasurementForm({ onMeasurementSaved }: MeasurementFormProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [calculatedFat, setCalculatedFat] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    weight: '',
    height: '',
    waist: '',
    neck: '',
    hips: '',
  })

  const loadProfileData = async () => {
    if (!user) return
    
    setIsLoadingProfile(true)
    try {
      const [profileData, weightEntries] = await Promise.all([
        getProfileByUserId(user.id),
        getWeightEntriesByUserId(user.id),
      ])
      
      setProfile(profileData)
      
      // Auto-fill weight and height from profile/latest entries
      const latestWeight = weightEntries.length > 0 
        ? weightEntries[weightEntries.length - 1].weight 
        : profileData?.weight
      
      if (latestWeight || profileData?.height) {
        setFormData(prev => ({
          ...prev,
          weight: latestWeight?.toString() || prev.weight,
          height: profileData?.height?.toString() || prev.height,
        }))
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  useEffect(() => {
    loadProfileData()
  }, [user])

  // Refresh profile data when page gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        loadProfileData()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])

  // Navy Body Fat Formula
  const calculateBodyFat = () => {
    const weight = parseFloat(formData.weight)
    const height = parseFloat(formData.height)
    const waist = parseFloat(formData.waist)
    const neck = parseFloat(formData.neck)
    const hips = parseFloat(formData.hips)
    
    if (!weight || !height || !waist || !neck) {
      return null
    }
    
    const gender = profile?.gender || 'male'
    
    let bodyFat: number
    
    if (gender === 'male') {
      // Navy formula for men: 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
    } else {
      // Navy formula for women: 495 / (1.29579 - 0.35004 * log10(waist + hips - neck) + 0.22100 * log10(height)) - 450
      if (!hips) return null
      bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height)) - 450
    }
    
    // Clamp to reasonable range
    return Math.max(3, Math.min(60, bodyFat))
  }

  const handleCalculate = () => {
    const fat = calculateBodyFat()
    setCalculatedFat(fat)
  }

  const handleSave = async () => {
    if (!user || calculatedFat === null) return
    
    setIsLoading(true)
    try {
      const measurement: BodyMeasurement = {
        id: crypto.randomUUID(),
        userId: user.id,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        waist: parseFloat(formData.waist),
        neck: parseFloat(formData.neck),
        hips: formData.hips ? parseFloat(formData.hips) : undefined,
        bodyFatPercentage: calculatedFat,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      }
      
      await saveBodyMeasurement(measurement)
      onMeasurementSaved()
      
      // Reset form except weight/height
      setFormData(prev => ({
        ...prev,
        waist: '',
        neck: '',
        hips: '',
      }))
      setCalculatedFat(null)
    } catch (error) {
      console.error('Error saving measurement:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshProfile = async () => {
    if (!user) return
    
    setIsLoadingProfile(true)
    try {
      const [profileData, weightEntries] = await Promise.all([
        getProfileByUserId(user.id),
        getWeightEntriesByUserId(user.id),
      ])
      
      setProfile(profileData)
      
      const latestWeight = weightEntries.length > 0 
        ? weightEntries[weightEntries.length - 1].weight 
        : profileData?.weight
      
      setFormData(prev => ({
        ...prev,
        weight: latestWeight?.toString() || prev.weight,
        height: profileData?.height?.toString() || prev.height,
      }))
    } catch (error) {
      console.error('Error refreshing profile:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const gender = profile?.gender || 'male'
  const isFormValid = formData.weight && formData.height && formData.waist && formData.neck && 
    (gender === 'male' || formData.hips)

  if (isLoadingProfile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Измерения тела</CardTitle>
            <CardDescription>
              Введите размеры для расчета процента жира по формуле ВМС США
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefreshProfile}
            disabled={isLoadingProfile}
            className="bg-transparent"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingProfile ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weight">Вес (кг)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              placeholder="70.5"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Загружен из профиля</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Рост (см)</Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              placeholder="175"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Загружен из профиля</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-4">Обмеры</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="waist">Обхват талии (см)</Label>
              <Input
                id="waist"
                type="number"
                step="0.1"
                placeholder="80"
                value={formData.waist}
                onChange={(e) => setFormData({ ...formData, waist: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">На уровне пупка</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="neck">Обхват шеи (см)</Label>
              <Input
                id="neck"
                type="number"
                step="0.1"
                placeholder="38"
                value={formData.neck}
                onChange={(e) => setFormData({ ...formData, neck: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Под кадыком</p>
            </div>
            {gender === 'female' && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="hips">Обхват бедер (см)</Label>
                <Input
                  id="hips"
                  type="number"
                  step="0.1"
                  placeholder="95"
                  value={formData.hips}
                  onChange={(e) => setFormData({ ...formData, hips: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">В самом широком месте</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 bg-transparent h-12 sm:h-10 text-base sm:text-sm"
            onClick={handleCalculate}
            disabled={!isFormValid}
          >
            <Calculator className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
            Рассчитать
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 sm:h-10 text-base sm:text-sm"
            onClick={handleSave}
            disabled={calculatedFat === null || isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
            )}
            Сохранить измерение
          </Button>
        </div>

        {calculatedFat !== null && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Рассчитанный процент жира</p>
            <p className="text-3xl font-bold text-primary mt-1">{calculatedFat.toFixed(1)}%</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
