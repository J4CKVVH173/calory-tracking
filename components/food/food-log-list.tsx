'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { FoodLog, FoodItem } from '@/lib/types'
import { deleteFoodLog, saveFoodLog } from '@/lib/api-storage'
import { Trash2, Utensils, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'

interface FoodLogListProps {
  logs: FoodLog[]
  onDelete: () => void
}

interface EditingState {
  logId: string
  itemIndex: number
}

export function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  const today = new Date().toISOString().split('T')[0]
  
  // Track which days are expanded - today is expanded by default
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([today]))
  const [editingItem, setEditingItem] = useState<EditingState | null>(null)
  const [editedValues, setEditedValues] = useState<FoodItem | null>(null)

  const handleDelete = async (logId: string) => {
    await deleteFoodLog(logId)
    onDelete()
  }

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  const startEditing = (logId: string, itemIndex: number, item: FoodItem) => {
    setEditingItem({ logId, itemIndex })
    setEditedValues({ ...item })
  }

  const cancelEditing = () => {
    setEditingItem(null)
    setEditedValues(null)
  }

  const handleEditChange = (field: keyof FoodItem, value: string | number) => {
    if (!editedValues) return
    
    if (field === 'name') {
      setEditedValues({ ...editedValues, name: value as string })
    } else if (field === 'weight') {
      // Recalculate all nutritional values proportionally when weight changes
      const newWeight = typeof value === 'string' ? parseFloat(value) || 0 : value
      const oldWeight = editedValues.weight || 1
      const ratio = newWeight / oldWeight
      
      setEditedValues({
        ...editedValues,
        weight: Math.round(newWeight),
        calories: Math.round(editedValues.calories * ratio),
        protein: Math.round(editedValues.protein * ratio),
        fat: Math.round(editedValues.fat * ratio),
        carbs: Math.round(editedValues.carbs * ratio),
      })
    } else if (field === 'protein' || field === 'fat' || field === 'carbs') {
      // Update the macro and recalculate calories from all macros
      const newVal = typeof value === 'string' ? Math.round(parseFloat(value) || 0) : Math.round(value)
      const p = field === 'protein' ? newVal : editedValues.protein
      const f = field === 'fat' ? newVal : editedValues.fat
      const c = field === 'carbs' ? newVal : editedValues.carbs
      setEditedValues({
        ...editedValues,
        [field]: newVal,
        calories: Math.round(p * 4 + f * 9 + c * 4),
      })
    } else {
      setEditedValues({
        ...editedValues,
        [field]: typeof value === 'string' ? Math.round(parseFloat(value) || 0) : Math.round(value),
      })
    }
  }

  const saveEdit = async () => {
    if (!editingItem || !editedValues) return
    
    const log = logs.find(l => l.id === editingItem.logId)
    if (!log) return
    
    const updatedItems = [...log.items]
    updatedItems[editingItem.itemIndex] = editedValues
    
    const updatedLog: FoodLog = {
      ...log,
      items: updatedItems,
    }
    
    await saveFoodLog(updatedLog)
    cancelEditing()
    onDelete() // Trigger refresh
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDayHeader = (dateString: string) => {
    const date = new Date(dateString)
    const isToday = dateString === today
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = dateString === yesterday.toISOString().split('T')[0]
    
    if (isToday) return 'Сегодня'
    if (isYesterday) return 'Вчера'
    
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const groupedLogs = logs.reduce((acc, log) => {
    const date = log.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(log)
    return acc
  }, {} as Record<string, FoodLog[]>)

  const sortedDates = Object.keys(groupedLogs).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Записей о питании пока нет</p>
          <p className="text-sm text-muted-foreground mt-1">
            Добавьте первую запись выше
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {sortedDates.map((date) => {
        const dayLogs = groupedLogs[date]
        const isExpanded = expandedDays.has(date)
        const isToday = date === today
        
        const dayCalories = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.calories, 0),
          0
        )
        const dayProtein = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.protein, 0),
          0
        )
        const dayFat = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.fat, 0),
          0
        )
        const dayCarbs = dayLogs.reduce(
          (sum, log) => sum + log.items.reduce((s, item) => s + item.carbs, 0),
          0
        )

        return (
          <Collapsible
            key={date}
            open={isExpanded}
            onOpenChange={() => toggleDay(date)}
          >
            <Card className={isToday ? 'border-primary/30' : ''}>
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <div className="font-semibold flex items-center gap-2">
                        {formatDayHeader(date)}
                        {isToday && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Сегодня
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dayLogs.length} {dayLogs.length === 1 ? 'прием' : dayLogs.length < 5 ? 'приема' : 'приемов'} пищи
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{dayCalories} ккал</div>
                    <div className="text-xs text-muted-foreground">
                      Б: {dayProtein.toFixed(0)}г | Ж: {dayFat.toFixed(0)}г | У: {dayCarbs.toFixed(0)}г
                    </div>
                  </div>
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {dayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-3 space-y-2 bg-muted/20"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(log.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(log.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        {log.items.map((item, index) => {
                          const isEditingThis = editingItem?.logId === log.id && editingItem?.itemIndex === index
                          
                          if (isEditingThis && editedValues) {
                            return (
                              <div key={index} className="py-2 bg-background rounded px-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editedValues.name}
                                    onChange={(e) => handleEditChange('name', e.target.value)}
                                    className="h-7 flex-1 text-sm"
                                    placeholder="Название"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={saveEdit}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={cancelEditing}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Вес, г</div>
                                    <Input
                                      type="number"
                                      value={editedValues.weight}
                                      onChange={(e) => handleEditChange('weight', e.target.value)}
                                      className="h-7 text-sm text-right"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Ккал</div>
                                    <Input
                                      type="number"
                                      value={editedValues.calories}
                                      onChange={(e) => handleEditChange('calories', e.target.value)}
                                      className="h-7 text-sm text-right bg-muted/50"
                                      readOnly
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Белки</div>
                                    <Input
                                      type="number"
                                      value={editedValues.protein}
                                      onChange={(e) => handleEditChange('protein', e.target.value)}
                                      className="h-7 text-sm text-right"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Жиры</div>
                                    <Input
                                      type="number"
                                      value={editedValues.fat}
                                      onChange={(e) => handleEditChange('fat', e.target.value)}
                                      className="h-7 text-sm text-right"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">Углев.</div>
                                    <Input
                                      type="number"
                                      value={editedValues.carbs}
                                      onChange={(e) => handleEditChange('carbs', e.target.value)}
                                      className="h-7 text-sm text-right"
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm py-1 group"
                            >
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                <span className="text-muted-foreground">({item.weight}г)</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startEditing(log.id, index, item)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">{item.calories} ккал</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {Math.round(item.protein)}/{Math.round(item.fat)}/{Math.round(item.carbs)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}
    </div>
  )
}
