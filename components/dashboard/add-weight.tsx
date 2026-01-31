'use client'

import React from "react"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { saveWeightEntry, getWeightEntriesByUserId, getProfileByUserId, saveProfile } from '@/lib/api-storage'
import { Scale, Plus } from 'lucide-react'

interface AddWeightProps {
  onWeightAdded: () => void
}

export function AddWeight({ onWeightAdded }: AddWeightProps) {
  const { user } = useAuth()
  const [weight, setWeight] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !weight) return

    const newWeight = Number.parseFloat(weight)
    const today = new Date().toISOString().split('T')[0]
    const existingEntries = await getWeightEntriesByUserId(user.id)
    const todayEntry = existingEntries.find((entry) => entry.date === today)

    if (todayEntry) {
      // Update today's entry
      todayEntry.weight = newWeight
      await saveWeightEntry(todayEntry)
    } else {
      // Create new entry
      await saveWeightEntry({
        id: crypto.randomUUID(),
        userId: user.id,
        weight: newWeight,
        date: today,
      })
    }

    // Also update profile weight for synchronization
    const profile = await getProfileByUserId(user.id)
    if (profile) {
      await saveProfile({
        ...profile,
        weight: newWeight,
        updatedAt: new Date().toISOString(),
      })
    }

    setWeight('')
    setIsOpen(false)
    onWeightAdded()
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto"
      >
        <Scale className="mr-2 h-4 w-4" />
        Добавить вес
      </Button>
    )
  }

  return (
    <Card className="animate-in fade-in slide-in-from-top-2 duration-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Записать вес
        </CardTitle>
        <CardDescription>Введите ваш текущий вес</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="number"
            step="0.1"
            placeholder="Вес в кг"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
            min="20"
            max="300"
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
          >
            Отмена
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
