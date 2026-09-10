import logger from '@adonisjs/core/services/logger'

/**
 * Every AI-provider adapter's only source of truth for *why* a call failed
 * — shared across receipt extraction and recipe generation (both have the
 * same three-provider shape: Gemini/OpenAI/Ollama, each catching its own
 * errors). The use-case one layer up (`ScanReceipt`, `GenerateRecipes`, …)
 * catches everything an adapter throws and converts it into one generic
 * `..._not_configured` / `..._failed` response for the client — without a
 * log at the point of failure, the actual cause (a bad API key, the model
 * refusing to return JSON, the provider being unreachable) left no trace
 * anywhere. `detail` is extra context worth a human's eyes — most often the
 * model's raw response, truncated, since the error message alone ("AI
 * response was not valid JSON") never says what the model actually sent
 * back; a network-failure caller passes something else useful instead.
 */
export function logAiAdapterFailure(feature: string, provider: string, error: unknown, detail?: string): void {
  logger.warn({ feature, provider, err: error, ...(detail ? { detail } : {}) }, `${feature} failed`)
}
