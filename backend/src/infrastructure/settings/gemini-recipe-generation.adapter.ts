import { GoogleGenAI } from '@google/genai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class GeminiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('gemini')

    const client = new GoogleGenAI({ apiKey: this.apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: buildRecipeGenerationPrompt(context) }] }],
    })

    return parseRecipeDraftsJson(response.text ?? '')
  }
}
