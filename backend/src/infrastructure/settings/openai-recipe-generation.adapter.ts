import OpenAI from 'openai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OpenAiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    let text: string
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildRecipeGenerationPrompt(context) }],
      })
      text = response.choices[0]?.message.content ?? ''
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'openai', error)
      throw error
    }

    try {
      return parseRecipeDraftsJson(text)
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'openai', error, text.slice(0, 500))
      throw error
    }
  }
}
