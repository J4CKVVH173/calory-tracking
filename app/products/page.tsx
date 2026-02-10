'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import {
  getProducts,
  saveProduct,
  deleteProduct,
  getUserFavorites,
  saveUserFavorite,
  deleteUserFavorite,
} from '@/lib/api-storage'
import type { Product, UserFavorite } from '@/lib/types'
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
  Star,
  Globe,
} from 'lucide-react'

/** Auto-calculate calories from macronutrients: P*4 + F*9 + C*4 */
function calcCalories(protein: string | number, fat: string | number, carbs: string | number): number {
  const p = typeof protein === 'string' ? parseFloat(protein) || 0 : protein
  const f = typeof fat === 'string' ? parseFloat(fat) || 0 : fat
  const c = typeof carbs === 'string' ? parseFloat(carbs) || 0 : carbs
  return Math.round(p * 4 + f * 9 + c * 4)
}

/** Declension for "продукт" */
function productCountLabel(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'продуктов'
  if (last > 1 && last < 5) return 'продукта'
  if (last === 1) return 'продукт'
  return 'продуктов'
}

type SortField = 'name' | 'calories' | 'protein' | 'useCount'
type SortDir = 'asc' | 'desc'
type ViewMode = 'all' | 'favorites'

interface BarcodeProduct {
  name: string
  weight: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

/** Row data combining product + optional favorite info */
interface ProductRow {
  product: Product
  favorite?: UserFavorite
  useCount: number
}

export default function ProductsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [favorites, setFavorites] = useState<UserFavorite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('useCount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Product> | null>(null)

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
      loadData()
    }
  }, [user, authLoading, router])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [productsData, favsData] = await Promise.all([
        getProducts(),
        getUserFavorites(user.id),
      ])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setFavorites(Array.isArray(favsData) ? favsData : [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Build favorite lookup: productId -> UserFavorite
  const favMap = useMemo(() => {
    const map = new Map<string, UserFavorite>()
    for (const f of favorites) {
      map.set(f.productId, f)
    }
    return map
  }, [favorites])

  const filteredAndSorted = useMemo(() => {
    let rows: ProductRow[] = products.map(p => ({
      product: p,
      favorite: favMap.get(p.id),
      useCount: favMap.get(p.id)?.useCount ?? 0,
    }))

    // View mode filter
    if (viewMode === 'favorites') {
      rows = rows.filter(r => r.favorite)
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      rows = rows.filter(
        r =>
          r.product.name.toLowerCase().includes(term) ||
          (r.product.barcode && r.product.barcode.includes(term))
      )
    }

    rows.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.product.name.localeCompare(b.product.name, 'ru')
          break
        case 'calories':
          cmp = a.product.calories - b.product.calories
          break
        case 'protein':
          cmp = a.product.protein - b.product.protein
          break
        case 'useCount':
          cmp = a.useCount - b.useCount
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return rows
  }, [products, favorites, favMap, searchTerm, sortField, sortDir, viewMode])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Toggle favorite
  const toggleFavorite = async (productId: string) => {
    if (!user) return
    const existing = favMap.get(productId)
    if (existing) {
      await deleteUserFavorite(existing.id)
      setFavorites(prev => prev.filter(f => f.id !== existing.id))
    } else {
      const newFav: UserFavorite = {
        id: crypto.randomUUID(),
        userId: user.id,
        productId,
        useCount: 0,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      await saveUserFavorite(newFav)
      setFavorites(prev => [...prev, newFav])
    }
  }

  // Barcode scan handler
  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false)
    setScannedBarcode(barcode)
    setLookupNotFound(false)
    setIsLookingUp(true)
    setShowAddForm(true)

    // Check if product with this barcode already exists in shared catalog
    const existing = products.find(f => f.barcode === barcode)
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
      setAutoCalcNew(false)
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
        setAutoCalcNew(false)
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

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditValues({
      name: product.name,
      barcode: product.barcode,
      weight: product.weight,
      calories: product.calories,
      protein: product.protein,
      fat: product.fat,
      carbs: product.carbs,
    })
    const formulaCalories = calcCalories(product.protein, product.fat, product.carbs)
    setAutoCalcEdit(Math.abs(product.calories - formulaCalories) <= 5)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editValues) return
    const product = products.find(p => p.id === editingId)
    if (!product) return

    const updated: Product = {
      ...product,
      name: editValues.name || product.name,
      barcode: editValues.barcode || product.barcode,
      weight: editValues.weight ?? product.weight,
      calories: editValues.calories ?? product.calories,
      protein: editValues.protein ?? product.protein,
      fat: editValues.fat ?? product.fat,
      carbs: editValues.carbs ?? product.carbs,
    }

    await saveProduct(updated)
    setProducts(prev => prev.map(p => (p.id === editingId ? updated : p)))
    cancelEdit()
  }

  const handleDelete = async (id: string) => {
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
    // favorites referencing this product are cleaned server-side
    setFavorites(prev => prev.filter(f => f.productId !== id))
  }

  const handleAddProduct = async () => {
    if (!user || !newProduct.name.trim()) return

    const product: Product = {
      id: crypto.randomUUID(),
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || undefined,
      weight: parseFloat(newProduct.weight) || 100,
      calories: parseFloat(newProduct.calories) || 0,
      protein: parseFloat(newProduct.protein) || 0,
      fat: parseFloat(newProduct.fat) || 0,
      carbs: parseFloat(newProduct.carbs) || 0,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }

    await saveProduct(product)
    setProducts(prev => [product, ...prev])

    // Auto-add to favorites
    const fav: UserFavorite = {
      id: crypto.randomUUID(),
      userId: user.id,
      productId: product.id,
      useCount: 0,
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    await saveUserFavorite(fav)
    setFavorites(prev => [...prev, fav])

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

  const favoritesCount = favorites.length

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
            {products.length} {productCountLabel(products.length)} в общей базе
            {favoritesCount > 0 && (
              <span className="ml-1">
                / {favoritesCount} в избранном
              </span>
            )}
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
                    : 'Продукт будет доступен всем пользователям'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-3">
            {isLookingUp ? (
              <div className="flex items-center justify-center py-6 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {'Ищем продукт по коду ' + scannedBarcode + '...'}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Порция, г</div>
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
                </div>
                <div className="text-xs font-medium text-muted-foreground pt-1">Показатели на 100 г:</div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      {'Ккал '}
                      {autoCalcNew && <span className="text-primary">*</span>}
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
                    <span className="text-primary">*</span> Калории рассчитываются автоматически: Б x 4 + Ж x 9 + У x 4
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

      {/* View mode toggle + Search */}
      <div className="flex gap-2 items-center">
        <div className="flex rounded-lg border overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Все
          </button>
          <button
            onClick={() => setViewMode('favorites')}
            className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'favorites' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            Избранное
            {favoritesCount > 0 && (
              <span className={`text-[10px] ${viewMode === 'favorites' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {favoritesCount}
              </span>
            )}
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск продуктов или штрих-код..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products list */}
      {filteredAndSorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-1">
              {searchTerm
                ? 'Ничего не найдено'
                : viewMode === 'favorites'
                  ? 'Нет избранных продуктов'
                  : 'База пуста'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchTerm
                ? 'Попробуйте изменить запрос'
                : viewMode === 'favorites'
                  ? 'Нажмите на звездочку рядом с продуктом, чтобы добавить его в избранное'
                  : 'Добавьте продукт вручную или отсканируйте штрих-код'}
            </p>
            {!searchTerm && viewMode !== 'favorites' && (
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
                  <th className="p-3 w-10" />
                  <th className="text-left p-3">
                    <SortButton field="name" label="Продукт" />
                  </th>
                  <th className="text-right p-3 w-16">Порция</th>
                  <th className="text-right p-3 w-20">
                    <SortButton field="calories" label="Ккал/100г" />
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
                {filteredAndSorted.map(({ product, favorite }) => {
                  const isEditing = editingId === product.id
                  const isFav = !!favorite
                  const canEdit = user && product.createdBy === user.id

                  if (isEditing && editValues) {
                    return (
                      <tr key={product.id} className="border-t">
                        <td colSpan={7} className="p-3">
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
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  Порция, г
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
                            </div>
                            <div className="text-[10px] font-medium text-muted-foreground">На 100 г:</div>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  {'Ккал '}
                                  {autoCalcEdit && <span className="text-primary">*</span>}
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
                      key={product.id}
                      className="border-t group hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-2 text-center">
                        <button
                          onClick={() => toggleFavorite(product.id)}
                          className="p-1 rounded transition-colors hover:bg-muted"
                          title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
                        >
                          <Star
                            className={`h-4 w-4 transition-colors ${
                              isFav ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/40'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{product.name}</div>
                        {product.barcode && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <ScanBarcode className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {product.barcode}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-right p-3 text-muted-foreground">
                        {product.weight}г
                      </td>
                      <td className="text-right p-3">{product.calories}</td>
                      <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                        {Math.round(product.protein)}/{Math.round(product.fat)}/
                        {Math.round(product.carbs)}
                      </td>
                      <td className="text-right p-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {favorite?.useCount ?? 0}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-7 sm:w-7"
                              onClick={() => startEdit(product)}
                            >
                              <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-7 sm:w-7 text-destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                            </Button>
                          )}
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
