import OpenAI from 'openai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class OpenAiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildRecipeGenerationPrompt(context) }],
    })

    return parseRecipeDraftsJson(response.choices[0]?.message.content ?? '')
  }
}
