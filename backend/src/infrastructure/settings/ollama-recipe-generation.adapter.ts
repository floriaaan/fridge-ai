import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class OllamaRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.model) throw new RecipeGenerationUnavailableError('ollama')

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: buildRecipeGenerationPrompt(context),
        stream: false,
      }),
    })
    if (!response.ok) throw new RecipeGenerationUnavailableError('ollama')

    const body = (await response.json()) as { response?: string }
    return parseRecipeDraftsJson(body.response ?? '')
  }
}
