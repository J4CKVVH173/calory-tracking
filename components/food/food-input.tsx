'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { saveFoodLog } from '@/lib/storage'
import type { FoodItem, FoodLog } from '@/lib/types'
import { Loader2, Plus } from 'lucide-react'

interface FoodInputProps {
  onFoodAdded: () => void
}

export function FoodInput({ onFoodAdded }: FoodInputProps) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<FoodItem[] | null>(null)

  const handleParse = async () => {
    if (!input.trim() || !user) return

    setIsLoading(true)
    setError(null)
    setParsedItems(null)

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
        setParsedItems(data.items)
      } else {
        setError('Пожалуйста, опишите еду иначе. Укажите продукты и их примерный вес.')
      }
    } catch {
      setError('Произошла ошибка. Попробуйте снова.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    if (!parsedItems || !user) return

    const foodLog: FoodLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      items: parsedItems,
      rawInput: input,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    }

    saveFoodLog(foodLog)
    setInput('')
    setParsedItems(null)
    onFoodAdded()
  }

  const totalCalories = parsedItems?.reduce((sum, item) => sum + item.calories, 0) || 0
  const totalProtein = parsedItems?.reduce((sum, item) => sum + item.protein, 0) || 0
  const totalFat = parsedItems?.reduce((sum, item) => sum + item.fat, 0) || 0
  const totalCarbs = parsedItems?.reduce((sum, item) => sum + item.carbs, 0) || 0

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Добавить еду
        </CardTitle>
        <CardDescription>
          Опишите что вы съели, и ИИ определит калории и нутриенты
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Например: яблоко 200г и кусок пиццы, или овсянка на молоке 300г с бананом..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={isLoading}
        />
        <Button onClick={handleParse} disabled={isLoading || !input.trim()} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализирую...
            </>
          ) : (
            'Распознать продукты'
          )}
        </Button>

        {error && (
          <p className="text-sm text-destructive animate-in fade-in duration-200 p-3 bg-destructive/10 rounded-lg">
            {error}
          </p>
        )}

        {parsedItems && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Продукт</th>
                    <th className="text-right p-3 font-medium">Вес</th>
                    <th className="text-right p-3 font-medium">Ккал</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">Б/Ж/У</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="text-right p-3">{item.weight}г</td>
                      <td className="text-right p-3 font-medium">{item.calories}</td>
                      <td className="text-right p-3 text-muted-foreground hidden sm:table-cell">
                        {item.protein}/{item.fat}/{item.carbs}
                      </td>
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
                  </tr>
                </tfoot>
              </table>
            </div>
            
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

            <Button onClick={handleSave} className="w-full" variant="default">
              Сохранить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
