'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { saveFoodLog, getSavedFoodsByUserId, saveSavedFood } from '@/lib/api-storage'
import type { FoodItem, FoodLog, SavedFood } from '@/lib/types'
import { Loader2, Plus, Search, Clock, Star, Pencil, Check, X, Bookmark } from 'lucide-react'

interface FoodInputProps {
  onFoodAdded: () => void
}

interface EditableFoodItem extends FoodItem {
  isEditing?: boolean
}

export function FoodInput({ onFoodAdded }: FoodInputProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<EditableFoodItem[] | null>(null)
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<SavedFood[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load saved foods on mount
  useEffect(() => {
    if (user) {
      getSavedFoodsByUserId(user.id).then(foods => {
        setSavedFoods(Array.isArray(foods) ? foods : [])
      })
    }
  }, [user])

  // Filter suggestions based on input
  useEffect(() => {
    if (input.trim().length > 0 && savedFoods.length > 0) {
      const searchTerm = input.toLowerCase()
      const filtered = savedFoods
        .filter(food => food.name.toLowerCase().includes(searchTerm))
        .slice(0, 5)
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [input, savedFoods])

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectSuggestion = (food: SavedFood) => {
    // Add to parsed items directly
    const newItem: EditableFoodItem = {
      name: food.name,
      weight: food.weight,
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    }
    setParsedItems(prev => prev ? [...prev, newItem] : [newItem])
    setInput('')
    setShowSuggestions(false)
    
    // Update use count
    updateSavedFoodUseCount(food)
  }

  const updateSavedFoodUseCount = async (food: SavedFood) => {
    const updatedFood: SavedFood = {
      ...food,
      useCount: food.useCount + 1,
      lastUsed: new Date().toISOString(),
    }
    await saveSavedFood(updatedFood)
    setSavedFoods(prev => prev.map(f => f.id === food.id ? updatedFood : f))
  }

  const handleParse = async () => {
    if (!input.trim() || !user) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/parse-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: input }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Не удалось распознать еду')
        return
      }

      if (data.items && data.items.length > 0) {
        const newItems = data.items.map((item: FoodItem) => ({ ...item, isEditing: false }))
        setParsedItems(prev => prev ? [...prev, ...newItems] : newItems)
        setInput('')
      } else {
        setError('Не удалось распознать — уточните описание')
      }
    } catch {
      setError('Произошла ошибка. Попробуйте снова.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditItem = (index: number) => {
    if (!parsedItems) return
    const updated = [...parsedItems]
    updated[index].isEditing = true
    setParsedItems(updated)
  }

  const handleCancelEdit = (index: number) => {
    if (!parsedItems) return
    const updated = [...parsedItems]
    updated[index].isEditing = false
    setParsedItems(updated)
  }

  const handleUpdateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    if (!parsedItems) return
    const updated = [...parsedItems]
    if (field === 'name') {
      updated[index][field] = value as string
    } else {
      updated[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value
    }
    setParsedItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    if (!parsedItems) return
    const updated = parsedItems.filter((_, i) => i !== index)
    setParsedItems(updated.length > 0 ? updated : null)
  }

  const handleSaveToDatabase = async (item: FoodItem) => {
    if (!user) return
    
    // Check if already exists
    const existing = savedFoods.find(f => 
      f.name.toLowerCase() === item.name.toLowerCase() && f.userId === user.id
    )
    
    if (existing) {
      // Update existing
      const updated: SavedFood = {
        ...existing,
        weight: item.weight,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        useCount: existing.useCount + 1,
        lastUsed: new Date().toISOString(),
      }
      await saveSavedFood(updated)
      setSavedFoods(prev => prev.map(f => f.id === existing.id ? updated : f))
    } else {
      // Create new
      const newSavedFood: SavedFood = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: item.name,
        weight: item.weight,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        useCount: 1,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      await saveSavedFood(newSavedFood)
      setSavedFoods(prev => [newSavedFood, ...prev])
    }
  }

  const handleSave = async () => {
    if (!parsedItems || !user) return

    const foodLog: FoodLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      items: parsedItems.map(({ isEditing, ...item }) => item),
      rawInput: input || 'Быстрое добавление',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    }

    await saveFoodLog(foodLog)
    
    // Save all items to user's food database
    for (const item of parsedItems) {
      await handleSaveToDatabase(item)
    }
    
    setInput('')
    setParsedItems(null)
    onFoodAdded()
  }

  const totalCalories = parsedItems?.reduce((sum, item) => sum + item.calories, 0) || 0
  const totalProtein = parsedItems?.reduce((sum, item) => sum + item.protein, 0) || 0
  const totalFat = parsedItems?.reduce((sum, item) => sum + item.fat, 0) || 0
  const totalCarbs = parsedItems?.reduce((sum, item) => sum + item.carbs, 0) || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Добавить еду
        </CardTitle>
        <CardDescription>
          Опишите что вы съели или выберите из истории
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input with autocomplete */}
        <div className="relative" ref={suggestionsRef}>
          <Textarea
            ref={inputRef}
            placeholder="Например: курица гриль 150г + салат с огурцом..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleParse()
              }
            }}
            rows={2}
            disabled={isLoading}
            className="pr-10"
          />
          
          {/* Autocomplete dropdown */}
          {showSuggestions && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 text-xs text-muted-foreground border-b flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Из вашей истории
              </div>
              {filteredSuggestions.map((food) => (
                <button
                  key={food.id}
                  onClick={() => handleSelectSuggestion(food)}
                  className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-medium">{food.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {food.weight}г • {food.calories} ккал
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {food.useCount}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleParse} 
            disabled={isLoading || !input.trim()} 
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализирую...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Распознать
              </>
            )}
          </Button>
        </div>

        {/* Quick add from frequent foods */}
        {savedFoods.length > 0 && !parsedItems && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Star className="h-4 w-4" />
              Частые продукты
            </div>
            <div className="flex flex-wrap gap-2">
              {savedFoods.slice(0, 6).map((food) => (
                <button
                  key={food.id}
                  onClick={() => handleSelectSuggestion(food)}
                  className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors flex items-center gap-1"
                >
                  {food.name}
                  <span className="text-xs text-muted-foreground">({food.calories})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
            {error}
          </p>
        )}

        {/* Parsed items with edit capability */}
        {parsedItems && parsedItems.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Продукт</th>
                    <th className="text-right p-3 font-medium w-20">Вес</th>
                    <th className="text-right p-3 font-medium w-20">Ккал</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell w-28">Б/Ж/У</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      {item.isEditing ? (
                        <>
                          <td className="p-2">
                            <Input
                              value={item.name}
                              onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                              className="h-8"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.weight}
                              onChange={(e) => handleUpdateItem(index, 'weight', e.target.value)}
                              className="h-8 w-16 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.calories}
                              onChange={(e) => handleUpdateItem(index, 'calories', e.target.value)}
                              className="h-8 w-16 text-right"
                            />
                          </td>
                          <td className="p-2 hidden sm:table-cell">
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={item.protein}
                                onChange={(e) => handleUpdateItem(index, 'protein', e.target.value)}
                                className="h-8 w-12 text-right text-xs"
                                title="Белки"
                              />
                              <Input
                                type="number"
                                value={item.fat}
                                onChange={(e) => handleUpdateItem(index, 'fat', e.target.value)}
                                className="h-8 w-12 text-right text-xs"
                                title="Жиры"
                              />
                              <Input
                                type="number"
                                value={item.carbs}
                                onChange={(e) => handleUpdateItem(index, 'carbs', e.target.value)}
                                className="h-8 w-12 text-right text-xs"
                                title="Углеводы"
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCancelEdit(index)}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3">{item.name}</td>
                          <td className="text-right p-3">{item.weight}г</td>
                          <td className="text-right p-3 font-medium">{item.calories}</td>
                          <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                            {item.protein}/{item.fat}/{item.carbs}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditItem(index)}
                                title="Редактировать"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleRemoveItem(index)}
                                title="Удалить"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-medium">
                  <tr className="border-t">
                    <td className="p-3">Итого</td>
                    <td className="text-right p-3">-</td>
                    <td className="text-right p-3 text-primary">{totalCalories}</td>
                    <td className="text-right p-3 hidden sm:table-cell">
                      {totalProtein.toFixed(1)}/{totalFat.toFixed(1)}/{totalCarbs.toFixed(1)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Mobile macro display */}
            <div className="grid grid-cols-4 gap-2 sm:hidden">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Белки</div>
                <div className="font-medium">{totalProtein.toFixed(1)}г</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Жиры</div>
                <div className="font-medium">{totalFat.toFixed(1)}г</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Углеводы</div>
                <div className="font-medium">{totalCarbs.toFixed(1)}г</div>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <div className="text-xs text-muted-foreground">Ккал</div>
                <div className="font-medium text-primary">{totalCalories}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">
                <Bookmark className="mr-2 h-4 w-4" />
                Сохранить
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setParsedItems(null)}
                className="bg-transparent"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
