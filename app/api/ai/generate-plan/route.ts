import { generateText } from 'ai'
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
    const { age, gender, weight, height, goal, lifestyle } = await request.json()

    const genderLabel = gender === 'male' ? 'мужчина' : 'женщина'
    const lifestyleLabel = lifestyleLabels[lifestyle] || lifestyle

    const prompt = `Ты профессиональный диетолог и фитнес-тренер. На основе следующих данных создай персональный план питания и рекомендации на русском языке.

Данные пользователя:
- Возраст: ${age} лет
- Пол: ${genderLabel}
- Вес: ${weight} кг
- Рост: ${height} см
- Образ жизни: ${lifestyleLabel}
- Цель: ${goal}

Пожалуйста, предоставь:
1. Рекомендуемое дневное потребление калорий
2. Распределение макронутриентов (белки, жиры, углеводы)
3. Рекомендации по режиму питания
4. Советы по достижению цели
5. Полезные привычки

Ответ должен быть структурированным, понятным и практичным. Используй русский язык.`


    const { text } = await generateText({
      model: defaultModel,
      prompt,
      maxOutputTokens: 1500,
    })

    return Response.json({ plan: text })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[v0] Error generating plan:', errorMessage, error)
    return Response.json(
      { error: 'Ошибка генерации плана', details: errorMessage },
      { status: 500 }
    )
  }
}
