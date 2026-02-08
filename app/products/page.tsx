'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { getSavedFoodsByUserId, saveSavedFood, deleteSavedFood } from '@/lib/api-storage'
import type { SavedFood } from '@/lib/types'
import { BarcodeScanner } from '@/components/products/barcode-scanner'
import {
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  Database,
  ArrowUpDown,
  Loader2,
  ScanBarcode,
} from 'lucide-react'

/** Auto-calculate calories from macronutrients: P*4 + F*9 + C*4 */
function calcCalories(protein: string | number, fat: string | number, carbs: string | number): number {
  const p = typeof protein === 'string' ? parseFloat(protein) || 0 : protein
  const f = typeof fat === 'string' ? parseFloat(fat) || 0 : fat
  const c = typeof carbs === 'string' ? parseFloat(carbs) || 0 : carbs
  return Math.round(p * 4 + f * 9 + c * 4)
}

type SortField = 'name' | 'calories' | 'protein' | 'useCount' | 'lastUsed'
type SortDir = 'asc' | 'desc'

interface BarcodeProduct {
  name: string
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

export default function ProductsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [foods, setFoods] = useState<SavedFood[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('useCount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<SavedFood> | null>(null)

  // Add product states
  const [showAddForm, setShowAddForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [lookupNotFound, setLookupNotFound] = useState(false)
  const [autoCalcNew, setAutoCalcNew] = useState(true)
  const [autoCalcEdit, setAutoCalcEdit] = useState(true)
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    weight: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
  })

  // Auto-calculate calories when macros change (new product form)
  const updateNewMacro = (field: 'protein' | 'fat' | 'carbs', value: string) => {
    setNewProduct(prev => {
      const updated = { ...prev, [field]: value }
      if (autoCalcNew) {
        updated.calories = String(calcCalories(updated.protein, updated.fat, updated.carbs))
      }
      return updated
    })
  }

  // Auto-calculate calories when macros change (edit form)
  const updateEditMacro = (field: 'protein' | 'fat' | 'carbs', value: string) => {
    setEditValues(prev => {
      if (!prev) return prev
      const numVal = Math.round(parseFloat(value) || 0)
      const updated = { ...prev, [field]: numVal }
      if (autoCalcEdit) {
        updated.calories = calcCalories(
          updated.protein ?? 0,
          updated.fat ?? 0,
          updated.carbs ?? 0,
        )
      }
      return updated
    })
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
      return
    }
    if (user) {
      loadFoods()
    }
  }, [user, authLoading, router])

  const loadFoods = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await getSavedFoodsByUserId(user.id)
      setFoods(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading foods:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...foods]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        f =>
          f.name.toLowerCase().includes(term) ||
          (f.barcode && f.barcode.includes(term))
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'ru')
          break
        case 'calories':
          cmp = a.calories - b.calories
          break
        case 'protein':
          cmp = a.protein - b.protein
          break
        case 'useCount':
          cmp = a.useCount - b.useCount
          break
        case 'lastUsed':
          cmp = new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime()
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [foods, searchTerm, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Barcode scan handler
  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false)
    setScannedBarcode(barcode)
    setLookupNotFound(false)
    setIsLookingUp(true)
    setShowAddForm(true)

    // Check if product with this barcode already exists in user's database
    const existing = foods.find(f => f.barcode === barcode)
    if (existing) {
      setNewProduct({
        name: existing.name,
        barcode,
        weight: String(existing.weight),
        calories: String(existing.calories),
        protein: String(existing.protein),
        fat: String(existing.fat),
        carbs: String(existing.carbs),
      })
      setAutoCalcNew(false) // Real data from DB, don't auto-calc
      setIsLookingUp(false)
      return
    }

    // Look up in Open Food Facts
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await res.json()

      if (data.found && data.product) {
        const p: BarcodeProduct = data.product
        setNewProduct({
          name: p.name || '',
          barcode,
          weight: String(p.weight || 100),
          calories: String(p.calories || ''),
          protein: String(p.protein || ''),
          fat: String(p.fat || ''),
          carbs: String(p.carbs || ''),
        })
        setAutoCalcNew(false) // Real data from Open Food Facts
      } else {
        setLookupNotFound(true)
        setNewProduct(prev => ({
          ...prev,
          barcode,
          name: '',
          weight: '100',
          calories: '',
          protein: '',
          fat: '',
          carbs: '',
        }))
      }
    } catch {
      setLookupNotFound(true)
      setNewProduct(prev => ({ ...prev, barcode }))
    } finally {
      setIsLookingUp(false)
    }
  }

  const startEdit = (food: SavedFood) => {
    setEditingId(food.id)
    setEditValues({
      name: food.name,
      barcode: food.barcode,
      weight: food.weight,
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    })
    // Enable auto-calc only if current calories roughly match the formula
    const formulaCalories = calcCalories(food.protein, food.fat, food.carbs)
    setAutoCalcEdit(Math.abs(food.calories - formulaCalories) <= 5)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editValues) return
    const food = foods.find(f => f.id === editingId)
    if (!food) return

    const updated: SavedFood = {
      ...food,
      name: editValues.name || food.name,
      barcode: editValues.barcode || food.barcode,
      weight: editValues.weight ?? food.weight,
      calories: editValues.calories ?? food.calories,
      protein: editValues.protein ?? food.protein,
      fat: editValues.fat ?? food.fat,
      carbs: editValues.carbs ?? food.carbs,
    }

    await saveSavedFood(updated)
    setFoods(prev => prev.map(f => (f.id === editingId ? updated : f)))
    cancelEdit()
  }

  const handleDelete = async (id: string) => {
    await deleteSavedFood(id)
    setFoods(prev => prev.filter(f => f.id !== id))
  }

  const handleAddProduct = async () => {
    if (!user || !newProduct.name.trim()) return

    const food: SavedFood = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || undefined,
      weight: parseFloat(newProduct.weight) || 100,
      calories: parseFloat(newProduct.calories) || 0,
      protein: parseFloat(newProduct.protein) || 0,
      fat: parseFloat(newProduct.fat) || 0,
      carbs: parseFloat(newProduct.carbs) || 0,
      useCount: 0,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    await saveSavedFood(food)
    setFoods(prev => [food, ...prev])
    resetAddForm()
  }

  const resetAddForm = () => {
    setNewProduct({ name: '', barcode: '', weight: '', calories: '', protein: '', fat: '', carbs: '' })
    setShowAddForm(false)
    setScannedBarcode(null)
    setLookupNotFound(false)
    setAutoCalcNew(true)
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
    >
      {label}
      {sortField === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  )

  if (authLoading || isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto px-2 py-4 sm:px-4 sm:py-8 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-balance">База продуктов</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {foods.length}{' '}
            {foods.length === 1
              ? 'продукт'
              : foods.length < 5
                ? 'продукта'
                : 'продуктов'}{' '}
            в вашей базе
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowScanner(true)
              setShowAddForm(false)
            }}
            className="bg-transparent h-11 sm:h-9 px-3 sm:px-4"
          >
            <ScanBarcode className="h-5 w-5 sm:h-4 sm:w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Сканировать</span>
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setShowScanner(false)
              setScannedBarcode(null)
              setLookupNotFound(false)
            }}
            className="h-11 sm:h-9 px-3 sm:px-4"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Add / Barcode-found product form */}
      {showAddForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {scannedBarcode ? 'Продукт по штрих-коду' : 'Новый продукт'}
            </CardTitle>
            <CardDescription>
              {isLookingUp
                ? 'Поиск продукта в базе Open Food Facts...'
                : lookupNotFound
                  ? `Продукт с кодом ${scannedBarcode} не найден. Заполните данные вручную.`
                  : scannedBarcode
                    ? 'Данные из Open Food Facts. Проверьте и сохраните.'
                    : 'Добавьте продукт вручную или отсканируйте штрих-код'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-3">
            {isLookingUp ? (
              <div className="flex items-center justify-center py-6 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Ищем продукт по коду {scannedBarcode}...
                </span>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Название продукта *"
                    value={newProduct.name}
                    onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1"
                    autoFocus={!scannedBarcode}
                  />
                  <div className="w-36 sm:w-44">
                    <Input
                      placeholder="Штрих-код"
                      value={newProduct.barcode}
                      onChange={e => setNewProduct(prev => ({ ...prev, barcode: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Вес, г</div>
                    <Input
                      type="number"
                      placeholder="100"
                      value={newProduct.weight}
                      onChange={e =>
                        setNewProduct(prev => ({ ...prev, weight: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      Ккал {autoCalcNew && <span className="text-primary">*</span>}
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newProduct.calories}
                      onChange={e => {
                        setAutoCalcNew(false)
                        setNewProduct(prev => ({ ...prev, calories: e.target.value }))
                      }}
                      className={`text-sm ${autoCalcNew ? 'bg-muted/50' : ''}`}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Белки</div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newProduct.protein}
                      onChange={e => updateNewMacro('protein', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Жиры</div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newProduct.fat}
                      onChange={e => updateNewMacro('fat', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Углев.</div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newProduct.carbs}
                      onChange={e => updateNewMacro('carbs', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                {autoCalcNew && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-primary">*</span> Калории рассчитываются автоматически по формуле: Б x 4 + Ж x 9 + У x 4
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddProduct}
                    disabled={!newProduct.name.trim()}
                    size="sm"
                  >
                    Сохранить
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetAddForm}
                    size="sm"
                    className="bg-transparent"
                  >
                    Отмена
                  </Button>
                  {!scannedBarcode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowScanner(true)
                        setShowAddForm(false)
                      }}
                      className="ml-auto bg-transparent"
                    >
                      <ScanBarcode className="h-4 w-4 mr-1.5" />
                      Сканировать
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск продуктов или штрих-код..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products list */}
      {filteredAndSorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-1">
              {searchTerm ? 'Ничего не найдено' : 'База пуста'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchTerm
                ? 'Попробуйте изменить запрос'
                : 'Добавьте продукт вручную или отсканируйте штрих-код'}
            </p>
            {!searchTerm && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanner(true)}
                  className="bg-transparent"
                >
                  <ScanBarcode className="h-4 w-4 mr-1.5" />
                  Сканировать
                </Button>
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Добавить вручную
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3">
                    <SortButton field="name" label="Продукт" />
                  </th>
                  <th className="text-right p-3 w-16">Вес</th>
                  <th className="text-right p-3 w-16">
                    <SortButton field="calories" label="Ккал" />
                  </th>
                  <th className="text-right p-3 hidden sm:table-cell">
                    <SortButton field="protein" label="Б/Ж/У" />
                  </th>
                  <th className="text-right p-3 w-12 hidden sm:table-cell">
                    <SortButton field="useCount" label="#" />
                  </th>
                  <th className="p-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(food => {
                  const isEditing = editingId === food.id

                  if (isEditing && editValues) {
                    return (
                      <tr key={food.id} className="border-t">
                        <td colSpan={6} className="p-3">
                          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Input
                                value={editValues.name ?? ''}
                                onChange={e =>
                                  setEditValues(prev => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                                className="h-8 flex-1 text-sm"
                                placeholder="Название"
                              />
                              <Input
                                value={editValues.barcode ?? ''}
                                onChange={e =>
                                  setEditValues(prev => ({
                                    ...prev,
                                    barcode: e.target.value,
                                  }))
                                }
                                className="h-8 w-28 sm:w-36 text-xs font-mono"
                                placeholder="Штрих-код"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={saveEdit}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Вес, г
                                </div>
                                <Input
                                  type="number"
                                  value={editValues.weight ?? 0}
                                  onChange={e =>
                                    setEditValues(prev => ({
                                      ...prev,
                                      weight: Math.round(
                                        parseFloat(e.target.value) || 0
                                      ),
                                    }))
                                  }
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Ккал {autoCalcEdit && <span className="text-primary">*</span>}
                                </div>
                                <Input
                                  type="number"
                                  value={editValues.calories ?? 0}
                                  onChange={e => {
                                    setAutoCalcEdit(false)
                                    setEditValues(prev => ({
                                      ...prev,
                                      calories: Math.round(
                                        parseFloat(e.target.value) || 0
                                      ),
                                    }))
                                  }}
                                  className={`h-8 text-sm text-right ${autoCalcEdit ? 'bg-muted/50' : ''}`}
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Белки
                                </div>
                                <Input
                                  type="number"
                                  value={editValues.protein ?? 0}
                                  onChange={e => updateEditMacro('protein', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Жиры
                                </div>
                                <Input
                                  type="number"
                                  value={editValues.fat ?? 0}
                                  onChange={e => updateEditMacro('fat', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Углев.
                                </div>
                                <Input
                                  type="number"
                                  value={editValues.carbs ?? 0}
                                  onChange={e => updateEditMacro('carbs', e.target.value)}
                                  className="h-8 text-sm text-right"
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={food.id}
                      className="border-t group hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-medium">{food.name}</div>
                        {food.barcode && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <ScanBarcode className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {food.barcode}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-right p-3 text-muted-foreground">
                        {food.weight}г
                      </td>
                      <td className="text-right p-3">{food.calories}</td>
                      <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                        {Math.round(food.protein)}/{Math.round(food.fat)}/
                        {Math.round(food.carbs)}
                      </td>
                      <td className="text-right p-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {food.useCount}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-7 sm:w-7"
                            onClick={() => startEdit(food)}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-7 sm:w-7 text-destructive"
                            onClick={() => handleDelete(food.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
