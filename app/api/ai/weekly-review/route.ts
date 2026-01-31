import { generateText } from 'ai'
import type { FoodLog, UserProfile } from '@/lib/types'
import { defaultModel } from '@/lib/openrouter'

const lifestyleLabels: Record<string, string> = {
  sedentary: 'сидячий образ жизни',
  light: 'легкая активность',
  moderate: 'умеренная активность',
  active: 'активный образ жизни',
  very_active: 'очень активный образ жизни',
}

export async function POST(request: Request) {
  try {
    const { logs, profile } = (await request.json()) as {
      logs: FoodLog[]
      profile: UserProfile
    }

    if (!logs || !profile) {
      return Response.json(
        { error: 'Данные о питании и профиль обязательны' },
        { status: 400 }
      )
    }

    // Calculate weekly stats
    const weeklyTotals = logs.reduce(
      (acc, log) => {
        log.items.forEach((item) => {
          acc.calories += item.calories
          acc.protein += item.protein
          acc.fat += item.fat
          acc.carbs += item.carbs
        })
        return acc
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    )

    const numDays = new Set(logs.map((l) => l.date)).size
    const avgCalories = numDays > 0 ? Math.round(weeklyTotals.calories / numDays) : 0
    const avgProtein = numDays > 0 ? (weeklyTotals.protein / numDays).toFixed(1) : '0'
    const avgFat = numDays > 0 ? (weeklyTotals.fat / numDays).toFixed(1) : '0'
    const avgCarbs = numDays > 0 ? (weeklyTotals.carbs / numDays).toFixed(1) : '0'

    // Get list of foods
    const allFoods = logs.flatMap((log) => log.items.map((item) => item.name))
    const uniqueFoods = [...new Set(allFoods)].slice(0, 20)

    const genderLabel = profile.gender === 'male' ? 'мужчина' : 'женщина'
    const lifestyleLabel = lifestyleLabels[profile.lifestyle] || profile.lifestyle

    const prompt = `Ты профессиональный диетолог. Проанализируй питание пользователя за неделю и дай краткие рекомендации на русском языке.

Данные пользователя:
- Возраст: ${profile.age} лет
- Пол: ${genderLabel}
- Текущий вес: ${profile.weight} кг
- Рост: ${profile.height} см
- Образ жизни: ${lifestyleLabel}
- Цель: ${profile.goal}

Статистика за неделю (${numDays} дней с записями):
- Среднее потребление калорий в день: ${avgCalories} ккал
- Среднее потребление белков: ${avgProtein}г
- Среднее потребление жиров: ${avgFat}г
- Среднее потребление углеводов: ${avgCarbs}г

Продукты в рационе: ${uniqueFoods.join(', ')}

Дай краткий анализ (3-5 пунктов):
1. Оцени соответствие питания цели пользователя
2. Укажи, каких нутриентов не хватает или слишком много
3. Дай конкретные рекомендации по улучшению рациона
4. Предложи продукты, которые стоит добавить или исключить

Будь кратким и конкретным. Используй дружелюбный тон.`

    const { text } = await generateText({
      model: defaultModel,
      prompt,
      maxOutputTokens: 800,
      temperature: 0.7,
    })

    return Response.json({ recommendation: text })
  } catch (error) {
    console.error('Error generating weekly review:', error)
    return Response.json(
      { error: 'Ошибка генерации рекомендаций' },
      { status: 500 }
    )
  }
}
