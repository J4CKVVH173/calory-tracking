import { generateText, Output } from 'ai'
import { z } from 'zod'
import { defaultModel } from '@/lib/openrouter'

const foodItemSchema = z.object({
  name: z.string().describe('Название продукта на русском'),
  weight: z.number().describe('Вес одной порции в граммах'),
  calories: z.number().describe('Калории на одну порцию'),
  protein: z.number().describe('Белки в граммах на одну порцию'),
  fat: z.number().describe('Жиры в граммах на одну порцию'),
  carbs: z.number().describe('Углеводы в граммах на одну порцию'),
  quantity: z.number().default(1).describe('Количество порций (по умолчанию 1)'),
})

const foodResponseSchema = z.object({
  items: z.array(foodItemSchema).describe('Список распознанных продуктов'),
  success: z.boolean().describe('Успешно ли распознаны продукты'),
})

export async function POST(request: Request) {
  try {
    const { description } = await request.json()

    if (!description || typeof description !== 'string') {
      return Response.json(
        { error: 'Описание еды обязательно' },
        { status: 400 }
      )
    }

    const prompt = `Ты эксперт по питанию. Проанализируй описание еды и верни информацию о каждом продукте.

Описание еды: "${description}"

Для каждого продукта определи:
- Название на русском
- Примерный вес в граммах (если не указан, используй стандартную порцию)
- Калории
- Белки, жиры, углеводы в граммах
- Количество порций (quantity) — если пользователь указал множитель (например "2 бутерброда", "3 яйца", "х2"), используй его. По умолчанию 1.

ВАЖНО: Если пользователь указал количество (например "2 бутерброда", "3 яйца вкрутую", "кофе x2"), установи quantity равным этому числу. Вес и нутриенты должны быть НА ОДНУ ПОРЦИЮ — клиент сам умножит на quantity.

Если описание непонятное или не содержит еды, установи success в false.
Используй реалистичные значения калорий и нутриентов на основе справочных данных.`

    const { output } = await generateText({
      model: defaultModel,
      output: Output.object({
        schema: foodResponseSchema,
      }),
      prompt,
      maxOutputTokens: 1000,
      temperature: 0.3,
    })

    if (!output || !output.success || !output.items || output.items.length === 0) {
      return Response.json(
        { error: 'Не удалось распознать продукты. Пожалуйста, опишите еду иначе.' },
        { status: 400 }
      )
    }

    return Response.json({ items: output.items })
  } catch (error) {
    console.error('Error parsing food:', error)
    return Response.json(
      { error: 'Ошибка распознавания еды' },
      { status: 500 }
    )
  }
}
