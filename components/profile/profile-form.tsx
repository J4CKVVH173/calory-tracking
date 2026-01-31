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
import type { UserProfile } from '@/lib/types'
import { lifestyleOptions, genderOptions } from '@/lib/types'
import { Loader2, Save, Sparkles, Pencil, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export function ProfileForm() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiPlan, setAiPlan] = useState<string | null>(null)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [editedPlan, setEditedPlan] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
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

  const saveProfileData = useCallback(async (planToSave?: string) => {
    if (!user) return
    
    const profile: UserProfile = {
      userId: user.id,
      age: Number.parseInt(formData.age) || 0,
      gender: formData.gender,
      weight: Number.parseFloat(formData.weight) || 0,
      height: Number.parseFloat(formData.height) || 0,
      goal: formData.goal,
      lifestyle: formData.lifestyle,
      aiPlan: planToSave ?? aiPlan ?? undefined,
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(profile)
  }, [user, formData, aiPlan])

  const handleSaveProfile = async () => {
    if (!user) return
    setIsSaving(true)
    
    try {
      await saveProfileData()
      
      // Save weight entry if weight changed
      const existingProfile = await getProfileByUserId(user.id)
      if (!existingProfile || existingProfile.weight !== Number.parseFloat(formData.weight)) {
        await saveWeightEntry({
          id: crypto.randomUUID(),
          userId: user.id,
          weight: Number.parseFloat(formData.weight),
          date: new Date().toISOString().split('T')[0],
        })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsLoading(true)

    try {
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
        throw new Error(data.error || 'Failed to generate plan')
      }

      const plan = data.plan

      const profile: UserProfile = {
        userId: user.id,
        age: Number.parseInt(formData.age),
        gender: formData.gender,
        weight: Number.parseFloat(formData.weight),
        height: Number.parseFloat(formData.height),
        goal: formData.goal,
        lifestyle: formData.lifestyle,
        aiPlan: plan,
        updatedAt: new Date().toISOString(),
      }

      await saveProfile(profile)

      // Save initial weight entry for chart visualization
      await saveWeightEntry({
        id: crypto.randomUUID(),
        userId: user.id,
        weight: Number.parseFloat(formData.weight),
        date: new Date().toISOString().split('T')[0],
      })

      setAiPlan(plan)
    } catch (error) {
      console.error('Error generating plan:', error)
      setAiPlan('Не удалось сгенерировать план. Пожалуйста, попробуйте позже.')
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
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 bg-transparent"
                onClick={handleSaveProfile}
                disabled={isSaving || isLoading}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="mr-2 h-4 w-4 text-primary" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess ? 'Сохранено!' : 'Сохранить профиль'}
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading || isSaving}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {aiPlan ? 'Перегенерировать план' : 'Получить план от AI'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                <ReactMarkdown>{aiPlan}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
