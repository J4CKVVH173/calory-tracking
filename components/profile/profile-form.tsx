'use client'

import React from "react"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { getProfileByUserId, saveProfile, saveWeightEntry } from '@/lib/api-storage'
import type { UserProfile, NutritionGoals } from '@/lib/types'
import { lifestyleOptions, genderOptions } from '@/lib/types'
import { Loader2, Save, Sparkles, Pencil, Check, X, Target } from 'lucide-react'
import { SimpleMarkdown } from '@/components/ui/simple-markdown'

export function ProfileForm() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiPlan, setAiPlan] = useState<string | null>(null)
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [isEditingGoals, setIsEditingGoals] = useState(false)
  const [editedPlan, setEditedPlan] = useState('')
  const [editedGoals, setEditedGoals] = useState<NutritionGoals>({ calories: 0, protein: 0, fat: 0, carbs: 0 })
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    age: '',
    gender: 'male' as 'male' | 'female',
    weight: '',
    height: '',
    goal: '',
    lifestyle: 'moderate' as UserProfile['lifestyle'],
  })

  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        setIsLoadingProfile(true)
        try {
          const profile = await getProfileByUserId(user.id)
          if (profile) {
            setFormData({
              age: profile.age.toString(),
              gender: profile.gender,
              weight: profile.weight.toString(),
              height: profile.height.toString(),
              goal: profile.goal,
              lifestyle: profile.lifestyle,
            })
            if (profile.aiPlan) {
              setAiPlan(profile.aiPlan)
            }
            if (profile.nutritionGoals) {
              setNutritionGoals(profile.nutritionGoals)
            }
          }
        } catch (error) {
          console.error('[v0] Error loading profile:', error)
        } finally {
          setIsLoadingProfile(false)
        }
      } else {
        setIsLoadingProfile(false)
      }
    }
    loadProfile()
  }, [user])

  // Use refs to always get the latest values in callbacks, avoiding stale closures
  const aiPlanRef = React.useRef(aiPlan)
  const nutritionGoalsRef = React.useRef(nutritionGoals)
  React.useEffect(() => { aiPlanRef.current = aiPlan }, [aiPlan])
  React.useEffect(() => { nutritionGoalsRef.current = nutritionGoals }, [nutritionGoals])

  const saveProfileData = useCallback(async (planToSave?: string, goalsToSave?: NutritionGoals) => {
    if (!user) return
    
    const profile: UserProfile = {
      userId: user.id,
      age: Number.parseInt(formData.age) || 0,
      gender: formData.gender,
      weight: Number.parseFloat(formData.weight) || 0,
      height: Number.parseFloat(formData.height) || 0,
      goal: formData.goal,
      lifestyle: formData.lifestyle,
      aiPlan: planToSave ?? aiPlanRef.current ?? undefined,
      nutritionGoals: goalsToSave ?? nutritionGoalsRef.current ?? undefined,
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(profile)
  }, [user, formData])

  const handleSaveProfile = async () => {
    if (!user) return
    setIsSaving(true)
    
    try {
      await saveProfileData()
      
      // Save weight entry if weight changed
      try {
        const existingProfile = await getProfileByUserId(user.id)
        if (!existingProfile || existingProfile.weight !== Number.parseFloat(formData.weight)) {
          await saveWeightEntry({
            id: crypto.randomUUID(),
            userId: user.id,
            weight: Number.parseFloat(formData.weight),
            date: new Date().toISOString().split('T')[0],
          })
        }
      } catch {
        // Non-critical
      }
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error('[v0] Error saving profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePlan = async () => {
    setAiPlan(editedPlan)
    await saveProfileData(editedPlan)
    setIsEditingPlan(false)
  }

  const handleCancelEditPlan = () => {
    setEditedPlan(aiPlan || '')
    setIsEditingPlan(false)
  }

  const handleStartEditPlan = () => {
    setEditedPlan(aiPlan || '')
    setIsEditingPlan(true)
  }

  const handleStartEditGoals = () => {
    setEditedGoals(nutritionGoals || { calories: 0, protein: 0, fat: 0, carbs: 0 })
    setIsEditingGoals(true)
  }

  const handleSaveGoals = async () => {
    setNutritionGoals(editedGoals)
    await saveProfileData(undefined, editedGoals)
    setIsEditingGoals(false)
  }

  const handleCancelEditGoals = () => {
    setEditedGoals(nutritionGoals || { calories: 0, protein: 0, fat: 0, carbs: 0 })
    setIsEditingGoals(false)
  }

  const handleRetry = () => {
    // Create a synthetic event for the form submit
    const form = document.querySelector('form')
    if (form) form.requestSubmit()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)
    setGenerateError(null)

    try {
      // Step 1: Save the profile data first (without AI plan) so it's never lost
      await saveProfileData()

      // Step 2: Save weight entry
      try {
        const existingProfile = await getProfileByUserId(user.id)
        if (!existingProfile || existingProfile.weight !== Number.parseFloat(formData.weight)) {
          await saveWeightEntry({
            id: crypto.randomUUID(),
            userId: user.id,
            weight: Number.parseFloat(formData.weight),
            date: new Date().toISOString().split('T')[0],
          })
        }
      } catch {
        // Non-critical: don't block plan generation if weight save fails
      }

      // Step 3: Call AI to generate plan
      const response = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: Number.parseInt(formData.age),
          gender: formData.gender,
          weight: Number.parseFloat(formData.weight),
          height: Number.parseFloat(formData.height),
          goal: formData.goal,
          lifestyle: formData.lifestyle,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Ошибка генерации плана')
      }

      if (!data.plan) {
        throw new Error('ИИ вернул пустой ответ. Попробуйте ещё раз.')
      }

      const plan = data.plan
      const goals = data.nutritionGoals as NutritionGoals

      // Step 4: Update local state immediately
      setAiPlan(plan)
      setNutritionGoals(goals)

      // Step 5: Persist the plan and goals to the profile
      await saveProfileData(plan, goals)

    } catch (error) {
      console.error('[v0] Error generating plan:', error)
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
      setGenerateError(message)
      // Do NOT overwrite aiPlan with the error -- keep the old plan visible
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle>Ваш профиль</CardTitle>
          <CardDescription>
            Заполните данные для получения персонального плана питания
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Возраст</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => { setFormData({ ...formData, age: e.target.value }); setGenerateError(null) }}
                  required
                  min="10"
                  max="120"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Пол</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value: 'male' | 'female') =>
                    setFormData({ ...formData, gender: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите пол" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Вес (кг)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="70"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  required
                  min="20"
                  max="300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Рост (см)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  required
                  min="100"
                  max="250"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lifestyle">Образ жизни</Label>
              <Select
                value={formData.lifestyle}
                onValueChange={(value: UserProfile['lifestyle']) =>
                  setFormData({ ...formData, lifestyle: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите образ жизни" />
                </SelectTrigger>
                <SelectContent>
                  {lifestyleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Цель</Label>
              <Textarea
                id="goal"
                placeholder="Например: похудеть на 10 кг, набрать мышечную массу..."
                value={formData.goal}
                onChange={(e) => { setFormData({ ...formData, goal: e.target.value }); setGenerateError(null) }}
                required
                rows={3}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 bg-transparent h-12 sm:h-10 text-base sm:text-sm"
                onClick={handleSaveProfile}
                disabled={isSaving || isLoading}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="mr-2 h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                ) : (
                  <Save className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                )}
                {saveSuccess ? 'Сохранено!' : 'Сохранить профиль'}
              </Button>
              <Button type="submit" className="flex-1 h-12 sm:h-10 text-base sm:text-sm" disabled={isLoading || isSaving}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                    {aiPlan ? 'Перегенерировать план' : 'Получить план от AI'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {generateError && (
        <Card className="border-destructive/50 bg-destructive/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2 shrink-0">
                <X className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive text-sm">Ошибка генерации плана</p>
                <p className="text-sm text-muted-foreground mt-1">{generateError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 bg-transparent"
                onClick={handleRetry}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Повторить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {nutritionGoals && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Цели питания
              </CardTitle>
              <CardDescription>
                Дневные нормы макронутриентов
              </CardDescription>
            </div>
            {!isEditingGoals ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditGoals}
                className="bg-transparent"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Изменить
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEditGoals}
                  className="bg-transparent"
                >
                  <X className="h-4 w-4 mr-1" />
                  Отмена
                </Button>
                <Button size="sm" onClick={handleSaveGoals}>
                  <Check className="h-4 w-4 mr-1" />
                  Сохранить
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditingGoals ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Калории (ккал)</Label>
                  <Input
                    type="number"
                    value={editedGoals.calories}
                    onChange={(e) => setEditedGoals({ ...editedGoals, calories: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Белки (г)</Label>
                  <Input
                    type="number"
                    value={editedGoals.protein}
                    onChange={(e) => setEditedGoals({ ...editedGoals, protein: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Жиры (г)</Label>
                  <Input
                    type="number"
                    value={editedGoals.fat}
                    onChange={(e) => setEditedGoals({ ...editedGoals, fat: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Углеводы (г)</Label>
                  <Input
                    type="number"
                    value={editedGoals.carbs}
                    onChange={(e) => setEditedGoals({ ...editedGoals, carbs: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="text-2xl font-bold text-orange-600">{nutritionGoals.calories}</div>
                  <div className="text-sm text-muted-foreground">ккал</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="text-2xl font-bold text-red-600">{nutritionGoals.protein}г</div>
                  <div className="text-sm text-muted-foreground">белки</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-2xl font-bold text-yellow-600">{nutritionGoals.fat}г</div>
                  <div className="text-sm text-muted-foreground">жиры</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-600">{nutritionGoals.carbs}г</div>
                  <div className="text-sm text-muted-foreground">углеводы</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {aiPlan && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Ваш персональный план</CardTitle>
              <CardDescription>
                Рекомендации от ИИ на основе ваших данных
              </CardDescription>
            </div>
            {!isEditingPlan ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditPlan}
                className="bg-transparent"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Редактировать
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEditPlan}
                  className="bg-transparent"
                >
                  <X className="h-4 w-4 mr-1" />
                  Отмена
                </Button>
                <Button
                  size="sm"
                  onClick={handleSavePlan}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Сохранить
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditingPlan ? (
              <Textarea
                value={editedPlan}
                onChange={(e) => setEditedPlan(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Введите ваш план в формате Markdown..."
              />
            ) : (
              <SimpleMarkdown content={aiPlan} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
