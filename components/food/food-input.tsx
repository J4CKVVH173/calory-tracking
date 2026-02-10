'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import {
  saveFoodLog,
  getUserFavoritesWithProducts,
  saveProduct,
  saveUserFavorite,
  type FavoriteWithProduct,
} from '@/lib/api-storage'
import type { FoodItem, FoodLog, Product, UserFavorite } from '@/lib/types'
import { Loader2, Plus, Search, Clock, Star, Pencil, Check, X, Bookmark, AlertTriangle, RotateCcw } from 'lucide-react'

interface FoodInputProps {
  onFoodAdded: () => void
}

/** Per-100g base values from DB or AI, used as source of truth for weight scaling */
interface Per100gBase {
  calories: number
  protein: number
  fat: number
  carbs: number
}

interface EditableFoodItem extends FoodItem {
  isEditing?: boolean
  quantity?: number
  /** Base per-100g values for recalculation. When present, weight changes
   *  always derive macros from this source instead of ratio-based scaling. */
  sourcePer100g?: Per100gBase
}

function hasMissingMacros(item: FoodItem): boolean {
  return item.calories > 0 && item.protein === 0 && item.fat === 0 && item.carbs === 0
}

function hasCalorieMismatch(item: FoodItem): boolean {
  if (item.protein === 0 && item.fat === 0 && item.carbs === 0) return false
  const calculated = Math.round(item.protein * 4 + item.fat * 9 + item.carbs * 4)
  // Scale tolerance with portion size: at least 5 kcal, or ~3% of calculated
  const tolerance = Math.max(5, Math.round(calculated * 0.03))
  return Math.abs(item.calories - calculated) > tolerance
}

/** Calculate calories from macros */
function calcCaloriesFromMacros(protein: number, fat: number, carbs: number): number {
  return Math.round(protein * 4 + fat * 9 + carbs * 4)
}

export function FoodInput({ onFoodAdded }: FoodInputProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<EditableFoodItem[] | null>(null)
  const [originalItems, setOriginalItems] = useState<Map<number, FoodItem>>(new Map())
  const [favProducts, setFavProducts] = useState<FavoriteWithProduct[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<FavoriteWithProduct[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load user's favorites with product data on mount
  useEffect(() => {
    if (user) {
      getUserFavoritesWithProducts(user.id).then(data => {
        setFavProducts(Array.isArray(data) ? data : [])
      })
    }
  }, [user])

  // Filter suggestions based on input
  useEffect(() => {
    if (input.trim().length > 0 && favProducts.length > 0) {
      const searchTerm = input.toLowerCase()
      const filtered = favProducts
        .filter(fp => fp.name.toLowerCase().includes(searchTerm))
        .slice(0, 5)
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [input, favProducts])

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

  /** Scale per-100g values to a given weight with 1-decimal precision */
  const scaleFromBase = (base: Per100gBase, weight: number) => {
    const ratio = weight / 100
    const protein = Math.round(base.protein * ratio * 10) / 10
    const fat = Math.round(base.fat * ratio * 10) / 10
    const carbs = Math.round(base.carbs * ratio * 10) / 10
    return {
      protein,
      fat,
      carbs,
      calories: calcCaloriesFromMacros(protein, fat, carbs),
    }
  }

  const handleSelectSuggestion = (fp: FavoriteWithProduct) => {
    // Product data stores macros per 100g. Keep source for future recalculations.
    const base: Per100gBase = {
      calories: fp.calories,
      protein: fp.protein,
      fat: fp.fat,
      carbs: fp.carbs,
    }
    const scaled = scaleFromBase(base, fp.weight)
    const newItem: EditableFoodItem = {
      name: fp.name,
      weight: fp.weight,
      ...scaled,
      quantity: 1,
      sourcePer100g: base,
    }
    setParsedItems(prev => prev ? [...prev, newItem] : [newItem])
    setInput('')
    setShowSuggestions(false)
    
    // Update use count on the favorite
    updateFavoriteUseCount(fp)
  }

  const updateFavoriteUseCount = async (fp: FavoriteWithProduct) => {
    const updatedFav: UserFavorite = {
      id: fp.favoriteId,
      userId: user!.id,
      productId: fp.productId,
      useCount: fp.useCount + 1,
      lastUsed: new Date().toISOString(),
      createdAt: fp.lastUsed, // preserve original
    }
    await saveUserFavorite(updatedFav)
    setFavProducts(prev => prev.map(f => f.favoriteId === fp.favoriteId 
      ? { ...f, useCount: updatedFav.useCount, lastUsed: updatedFav.lastUsed } 
      : f
    ))
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
        const newItems = data.items.map((item: FoodItem & { quantity?: number }) => {
          // Derive per-100g base from the AI-returned absolute values
          const w = item.weight || 100
          const ratio = 100 / w
          return {
            ...item,
            quantity: item.quantity || 1,
            isEditing: false,
            sourcePer100g: {
              protein: Math.round(item.protein * ratio * 10) / 10,
              fat: Math.round(item.fat * ratio * 10) / 10,
              carbs: Math.round(item.carbs * ratio * 10) / 10,
              calories: calcCaloriesFromMacros(
                Math.round(item.protein * ratio * 10) / 10,
                Math.round(item.fat * ratio * 10) / 10,
                Math.round(item.carbs * ratio * 10) / 10,
              ),
            } as Per100gBase,
          }
        })
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
    // Store original values before editing
    const item = parsedItems[index]
    setOriginalItems(prev => {
      const next = new Map(prev)
      next.set(index, { name: item.name, weight: item.weight, calories: item.calories, protein: item.protein, fat: item.fat, carbs: item.carbs })
      return next
    })
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

  const handleResetItem = (index: number) => {
    if (!parsedItems) return
    const original = originalItems.get(index)
    if (!original) return
    const updated = [...parsedItems]
    updated[index] = { ...original, isEditing: true }
    setParsedItems(updated)
  }

  const handleUpdateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    if (!parsedItems) return
    const updated = [...parsedItems]
    const item = updated[index]
    
    if (field === 'name') {
      item.name = value as string
    } else if (field === 'weight') {
      const newWeight = typeof value === 'string' ? parseFloat(value) || 0 : value
      item.weight = Math.round(newWeight)
      
      if (item.sourcePer100g) {
        // Source-based recalculation: always derive from per-100g base (no precision loss)
        const scaled = scaleFromBase(item.sourcePer100g, newWeight)
        item.protein = scaled.protein
        item.fat = scaled.fat
        item.carbs = scaled.carbs
        item.calories = scaled.calories
      } else {
        // Fallback: ratio-based scaling when no source data (e.g. AI-parsed items)
        const oldWeight = originalItems.get(index)?.weight || item.weight || 1
        const orig = originalItems.get(index)
        if (orig) {
          const ratio = newWeight / orig.weight
          item.protein = Math.round(orig.protein * ratio * 10) / 10
          item.fat = Math.round(orig.fat * ratio * 10) / 10
          item.carbs = Math.round(orig.carbs * ratio * 10) / 10
          item.calories = calcCaloriesFromMacros(item.protein, item.fat, item.carbs)
        }
      }
    } else if (field === 'calories') {
      // User explicitly sets calories — just update
      item.calories = typeof value === 'string' ? Math.round(parseFloat(value) || 0) : Math.round(value)
    } else {
      // protein, fat, carbs — update value, recalculate calories, and update source base
      const numVal = typeof value === 'string' ? (parseFloat(value) || 0) : value
      item[field] = Math.round(numVal * 10) / 10
      item.calories = calcCaloriesFromMacros(item.protein, item.fat, item.carbs)
      
      // Update the per-100g source so future weight changes use user's corrected values
      if (item.sourcePer100g && item.weight > 0) {
        const ratio = 100 / item.weight
        item.sourcePer100g = {
          protein: Math.round(item.protein * ratio * 10) / 10,
          fat: Math.round(item.fat * ratio * 10) / 10,
          carbs: Math.round(item.carbs * ratio * 10) / 10,
          calories: calcCaloriesFromMacros(
            Math.round(item.protein * ratio * 10) / 10,
            Math.round(item.fat * ratio * 10) / 10,
            Math.round(item.carbs * ratio * 10) / 10,
          ),
        }
      }
    }
    
    setParsedItems(updated)
  }

  const handleQuantityChange = (index: number, newQty: number) => {
    if (!parsedItems || newQty < 1) return
    const updated = [...parsedItems]
    updated[index].quantity = newQty
    setParsedItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    if (!parsedItems) return
    const updated = parsedItems.filter((_, i) => i !== index)
    setParsedItems(updated.length > 0 ? updated : null)
  }

  const handleSaveToDatabase = async (item: EditableFoodItem) => {
    if (!user) return
    
    // Get per-100g values: prefer sourcePer100g if available (already tracked),
    // otherwise normalize from absolute values
    let per100: Per100gBase
    if (item.sourcePer100g) {
      per100 = { ...item.sourcePer100g }
    } else {
      const weight = item.weight || 100
      const ratio = 100 / weight
      const protein = Math.round(item.protein * ratio * 10) / 10
      const fat = Math.round(item.fat * ratio * 10) / 10
      const carbs = Math.round(item.carbs * ratio * 10) / 10
      per100 = {
        calories: calcCaloriesFromMacros(protein, fat, carbs),
        protein,
        fat,
        carbs,
      }
    }

    const weight = item.weight || 100

    // Check if product already exists in user's favorites
    const existingFav = favProducts.find(f => 
      f.name.toLowerCase() === item.name.toLowerCase()
    )
    
    if (existingFav) {
      // Check if per-100g values have changed (user edited macros)
      const macrosChanged =
        Math.abs(existingFav.protein - per100.protein) > 0.2 ||
        Math.abs(existingFav.fat - per100.fat) > 0.2 ||
        Math.abs(existingFav.carbs - per100.carbs) > 0.2

      // Update product in shared catalog if macros changed and user is creator
      if (macrosChanged && existingFav.createdBy === user.id) {
        const updatedProduct: Product = {
          id: existingFav.productId,
          name: item.name,
          weight,
          calories: per100.calories,
          protein: per100.protein,
          fat: per100.fat,
          carbs: per100.carbs,
          createdBy: user.id,
          createdAt: existingFav.lastUsed,
        }
        await saveProduct(updatedProduct)
      }

      // Bump use count on favorite
      const updatedFav: UserFavorite = {
        id: existingFav.favoriteId,
        userId: user.id,
        productId: existingFav.productId,
        useCount: existingFav.useCount + 1,
        lastUsed: new Date().toISOString(),
        createdAt: existingFav.lastUsed,
      }
      await saveUserFavorite(updatedFav)
      setFavProducts(prev => prev.map(f => 
        f.favoriteId === existingFav.favoriteId 
          ? { 
              ...f, 
              useCount: updatedFav.useCount, 
              lastUsed: updatedFav.lastUsed,
              ...(macrosChanged && existingFav.createdBy === user.id && {
                calories: per100.calories,
                protein: per100.protein,
                fat: per100.fat,
                carbs: per100.carbs,
                weight,
              }),
            } 
          : f
      ))
    } else {
      // Create new product in shared catalog
      const productId = crypto.randomUUID()
      const newProduct: Product = {
        id: productId,
        name: item.name,
        weight,
        calories: per100.calories,
        protein: per100.protein,
        fat: per100.fat,
        carbs: per100.carbs,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      }
      await saveProduct(newProduct)

      // Add to user's favorites
      const favId = crypto.randomUUID()
      const newFav: UserFavorite = {
        id: favId,
        userId: user.id,
        productId,
        useCount: 1,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      await saveUserFavorite(newFav)

      // Update local state
      const newFavWithProduct: FavoriteWithProduct = {
        favoriteId: favId,
        productId,
        name: newProduct.name,
        weight: newProduct.weight,
        calories: newProduct.calories,
        protein: newProduct.protein,
        fat: newProduct.fat,
        carbs: newProduct.carbs,
        useCount: 1,
        lastUsed: newFav.lastUsed,
        createdBy: user.id,
        isFavorite: true,
      }
      setFavProducts(prev => [newFavWithProduct, ...prev])
    }
  }

  const handleSave = async () => {
    if (!parsedItems || !user) return

    // Expand quantities: multiply weight/calories/macros by quantity for storage
    const expandedItems = parsedItems.map(({ isEditing, quantity, ...item }) => {
      const qty = quantity || 1
      return {
        name: qty > 1 ? `${item.name} x${qty}` : item.name,
        weight: Math.round(item.weight * qty),
        calories: Math.round(item.calories * qty),
        protein: Math.round(item.protein * qty),
        fat: Math.round(item.fat * qty),
        carbs: Math.round(item.carbs * qty),
      }
    })

    const foodLog: FoodLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      items: expandedItems,
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

  const totalCalories = parsedItems?.reduce((sum, item) => sum + item.calories * (item.quantity || 1), 0) || 0
  const totalProtein = parsedItems?.reduce((sum, item) => sum + item.protein * (item.quantity || 1), 0) || 0
  const totalFat = parsedItems?.reduce((sum, item) => sum + item.fat * (item.quantity || 1), 0) || 0
  const totalCarbs = parsedItems?.reduce((sum, item) => sum + item.carbs * (item.quantity || 1), 0) || 0

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
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
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
              {filteredSuggestions.map((fp) => (
                <button
                  key={fp.favoriteId}
                  onClick={() => handleSelectSuggestion(fp)}
                  className="w-full px-3 py-3 sm:py-2 text-left hover:bg-muted flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-medium">{fp.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fp.weight}г {' \u2022 '} {Math.round(fp.calories * fp.weight / 100)} ккал
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {fp.useCount}
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
            className="flex-1 h-11 sm:h-10 text-base sm:text-sm"
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

        {/* Quick add from frequent foods (favorites) */}
        {favProducts.length > 0 && !parsedItems && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Star className="h-4 w-4" />
              Частые продукты
            </div>
            <div className="flex flex-wrap gap-2">
              {favProducts.slice(0, 6).map((fp) => (
                <button
                  key={fp.favoriteId}
                  onClick={() => handleSelectSuggestion(fp)}
                  className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors flex items-center gap-1"
                >
                  {fp.name}
                  <span className="text-xs text-muted-foreground">({Math.round(fp.calories * fp.weight / 100)})</span>
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
                    <th className="text-center p-3 font-medium w-16">Кол.</th>
                    <th className="text-right p-3 font-medium w-20">Вес</th>
                    <th className="text-right p-3 font-medium w-20">Ккал</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">Б/Ж/У</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, index) => (
                    item.isEditing ? (
                      <tr key={index} className="border-t">
                        <td colSpan={6} className="p-3">
                          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Input
                                value={item.name}
                                onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                                className="h-8 flex-1 text-sm"
                                placeholder="Название продукта"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleResetItem(index)}
                                title="Сбросить изменения"
                              >
                                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleCancelEdit(index)}
                                title="Готово"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            </div>
                            {hasCalorieMismatch(item) && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>
                                  {'Калории не совпадают с БЖУ (расчёт: '}
                                  {Math.round(item.protein * 4 + item.fat * 9 + item.carbs * 4)}
                                  {' ккал)'}
                                </span>
                              </div>
                            )}
                            <div className="grid grid-cols-5 gap-2">
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Вес, г</div>
                                <Input
                                  type="number"
                                  value={item.weight}
                                  onChange={(e) => handleUpdateItem(index, 'weight', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Ккал <span className="text-primary">*</span>
                                </div>
                                <Input
                                  type="number"
                                  value={item.calories}
                                  onChange={(e) => handleUpdateItem(index, 'calories', e.target.value)}
                                  className={`h-8 text-sm text-right bg-muted/50 ${hasCalorieMismatch(item) ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Белки</div>
                                <Input
                                  type="number"
                                  value={item.protein}
                                  onChange={(e) => handleUpdateItem(index, 'protein', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Жиры</div>
                                <Input
                                  type="number"
                                  value={item.fat}
                                  onChange={(e) => handleUpdateItem(index, 'fat', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Углев.</div>
                                <Input
                                  type="number"
                                  value={item.carbs}
                                  onChange={(e) => handleUpdateItem(index, 'carbs', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {item.name}
                            {hasMissingMacros(item) && (
                              <span title="Нет данных о БЖУ">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                            {hasCalorieMismatch(item) && (
                              <span title={`Калории не совпадают с БЖУ (расчёт: ${Math.round(item.protein * 4 + item.fat * 9 + item.carbs * 4)} ккал)`}>
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(index, (item.quantity || 1) - 1)}
                              disabled={(item.quantity || 1) <= 1}
                            >
                              <span className="text-base leading-none">-</span>
                            </Button>
                            <span className="w-5 text-center text-sm font-medium">{item.quantity || 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(index, (item.quantity || 1) + 1)}
                            >
                              <span className="text-base leading-none">+</span>
                            </Button>
                          </div>
                        </td>
                        <td className="text-right p-3">{item.weight * (item.quantity || 1)}г</td>
                        <td className="text-right p-3 font-medium">{item.calories * (item.quantity || 1)}</td>
                        <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                          {Math.round(item.protein * (item.quantity || 1))}/{Math.round(item.fat * (item.quantity || 1))}/{Math.round(item.carbs * (item.quantity || 1))}
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
                      </tr>
                    )
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-medium">
                  <tr className="border-t">
                    <td className="p-3">Итого</td>
                    <td></td>
                    <td className="text-right p-3">-</td>
                    <td className="text-right p-3 text-primary">{totalCalories}</td>
                    <td className="text-right p-3 hidden sm:table-cell">
                      {Math.round(totalProtein)}/{Math.round(totalFat)}/{Math.round(totalCarbs)}
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
                <div className="font-medium">{Math.round(totalProtein)}г</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Жиры</div>
                <div className="font-medium">{Math.round(totalFat)}г</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Углеводы</div>
                <div className="font-medium">{Math.round(totalCarbs)}г</div>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <div className="text-xs text-muted-foreground">Ккал</div>
                <div className="font-medium text-primary">{totalCalories}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-11 sm:h-10 text-base sm:text-sm">
                <Bookmark className="mr-2 h-5 w-5 sm:h-4 sm:w-4" />
                Сохранить
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setParsedItems(null)}
                className="bg-transparent h-11 sm:h-10 text-base sm:text-sm"
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
