import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OllamaRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.model) throw new RecipeGenerationUnavailableError('ollama')

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: buildRecipeGenerationPrompt(context),
          stream: false,
        }),
      })
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'ollama', error, `unreachable at ${this.baseUrl}`)
      throw new RecipeGenerationUnavailableError('ollama')
    }
    if (!response.ok) {
      logAiAdapterFailure(
        'recipe-generation',
        'ollama',
        new Error(`HTTP ${response.status}`),
        await response.text().catch(() => undefined),
      )
      throw new RecipeGenerationUnavailableError('ollama')
    }

    const body = (await response.json()) as { response?: string }
    const text = body.response ?? ''
    try {
      return parseRecipeDraftsJson(text)
    } catch (error) {
      logAiAdapterFailure('recipe-generation', 'ollama', error, text.slice(0, 500))
      throw error
    }
  }
}
