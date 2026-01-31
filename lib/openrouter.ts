import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Default model for the app - using Google Gemini Flash for reliability
export const defaultModel = openrouter('google/gemini-2.5-flash-lite')
