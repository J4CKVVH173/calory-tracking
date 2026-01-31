import { generateText } from 'ai'
import { defaultModel } from '@/lib/openrouter'

const lifestyleLabels: Record<string, string> = {
  sedentary: 'сидячий образ жизни',
  light: 'легкая активность',
  moderate: 'умеренная активность',
  active: 'активный образ жизни',
  very_active: 'очень активный образ жизни',
}

const lifestyleMultipliers: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

function calculateNutritionGoals(
  age: number,
  gender: string,
  weight: number,
  height: number,
  lifestyle: string,
  goal: string
) {
  // Calculate BMR using Mifflin-St Jeor
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  // Calculate TDEE
  const multiplier = lifestyleMultipliers[lifestyle] || 1.55
  const tdee = bmr * multiplier

  // Adjust based on goal
  const goalLower = goal.toLowerCase()
  let targetCalories = tdee
  
  if (goalLower.includes('похуд') || goalLower.includes('сброс') || goalLower.includes('сушк')) {
    targetCalories = tdee * 0.8 // 20% deficit
  } else if (goalLower.includes('набор') || goalLower.includes('масс') || goalLower.includes('рост')) {
    targetCalories = tdee * 1.15 // 15% surplus
  }

  // Calculate macros
  const protein = Math.round(weight * 2) // 2g per kg
  const fat = Math.round((targetCalories * 0.25) / 9) // 25% of calories from fat
  const carbs = Math.round((targetCalories - protein * 4 - fat * 9) / 4) // Remaining from carbs

  return {
    calories: Math.round(targetCalories),
    protein,
    fat,
    carbs,
  }
}

export async function POST(request: Request) {
  try {
    const { age, gender, weight, height, goal, lifestyle } = await request.json()

    const genderLabel = gender === 'male' ? 'мужчина' : 'женщина'
    const lifestyleLabel = lifestyleLabels[lifestyle] || lifestyle

    // Calculate nutrition goals
    const nutritionGoals = calculateNutritionGoals(age, gender, weight, height, lifestyle, goal)

    const prompt = `Ты профессиональный диетолог и фитнес-тренер с опытом работы с продвинутыми атлетами. На основе данных пользователя создай персональный план питания и рекомендации на русском языке. Пользователь не новичок в тренировках, поэтому избегай базовых объяснений и воды — фокусируйся на конкретных расчётах, примерах и обоснованиях. Делай ответ кратким, но детализированным: используй формулы для расчётов, точные цифры, примеры меню и метрики для отслеживания прогресса.

Данные пользователя:
- Возраст: ${age} лет
- Пол: ${genderLabel}
- Вес: ${weight} кг
- Рост: ${height} см
- Образ жизни: ${lifestyleLabel} (учти уровень активности: седentarный — multiplier 1.2, лёгкий — 1.375, умеренный — 1.55, активный — 1.725, очень активный — 1.9)
- Цель: ${goal} (адаптируй под цель: похудение — дефицит 20-25% от TDEE, набор массы — surplus 10-20%, поддержание — TDEE)

Рассчитанные цели (используй эти значения в плане):
- Калории: ${nutritionGoals.calories} ккал/день
- Белки: ${nutritionGoals.protein} г/день
- Жиры: ${nutritionGoals.fat} г/день
- Углеводы: ${nutritionGoals.carbs} г/день

Сначала рассчитай:
- BMR по формуле Mifflin-St Jeor: для мужчин BMR = 10*вес + 6.25*рост - 5*возраст + 5; для женщин -161 вместо +5.
- TDEE = BMR * multiplier по образу жизни.

Затем предоставь структурированный ответ только в следующем формате (без лишнего текста):
1. Рекомендуемое дневное потребление калорий: ${nutritionGoals.calories} ккал (обоснование: BMR=[расчёт], TDEE=[расчёт], adjustment под цель=[дефицит/surplus]).
2. Распределение макронутриентов: Белки ${nutritionGoals.protein}г, Жиры ${nutritionGoals.fat}г, Углеводы ${nutritionGoals.carbs}г. Обоснование под цель.
3. Рекомендации по режиму питания: [3-5 приёмов/день, примеры блюд на день с калориями и макросами, фокус на timing вокруг тренировок].
4. Советы по достижению цели: [3-5 конкретных тактик с метриками, например, "Еженедельно корректируй калории на основе веса: если не теряешь 0.5-1кг/нед, уменьши на 200ккал"].
5. Полезные привычки: [4-6 actionable привычек, например, "Фиксируй intake в app ежедневно, цель — 90% compliance"].

Ответ должен быть практическим, с примерами и без общих фраз вроде "ешьте здоровую пищу". Используй только русский язык.`


    const { text } = await generateText({
      model: defaultModel,
      prompt,
      maxOutputTokens: 1500,
    })

    return Response.json({ plan: text, nutritionGoals })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[v0] Error generating plan:', errorMessage, error)
    return Response.json(
      { error: 'Ошибка генерации плана', details: errorMessage },
      { status: 500 }
    )
  }
}
