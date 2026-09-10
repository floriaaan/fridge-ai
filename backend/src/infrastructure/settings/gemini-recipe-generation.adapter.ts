import { GoogleGenAI } from '@google/genai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class GeminiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('gemini')

    const client = new GoogleGenAI({ apiKey: this.apiKey })
    let text: string
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: buildRecipeGenerationPrompt(context) }] }],
      })
      text = response.text ?? ''
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'gemini', error)
      throw error
    }

    try {
      return parseRecipeDraftsJson(text)
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'gemini', error, text.slice(0, 500))
      throw error
    }
  }
}
