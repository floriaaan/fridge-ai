import env from '#start/env'
import { GeminiReceiptExtractionAdapter } from './gemini-receipt-extraction.adapter.js'
import { OpenAiReceiptExtractionAdapter } from './openai-receipt-extraction.adapter.js'
import { OllamaReceiptExtractionAdapter } from './ollama-receipt-extraction.adapter.js'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

let cached: { adapter: ReceiptExtractionPort; signature: AiProvider } | null = null
let testOverride: ReceiptExtractionPort | null = null

/**
 * Test-only seam — when set, `resolveReceiptExtractionAdapter` short-
 * circuits to it instead of resolving env/DB-backed settings and
 * constructing a real SDK client. Never call this outside a test; the name
 * is prefixed `__` specifically to stand out at call sites.
 */
export function __setReceiptExtractionOverrideForTests(port: ReceiptExtractionPort | null): void {
  testOverride = port
  cached = null
}

function buildAdapter(provider: AiProvider): ReceiptExtractionPort {
  switch (provider) {
    case 'gemini':
      return new GeminiReceiptExtractionAdapter(env.get('GEMINI_API_KEY', ''))
    case 'openai':
      return new OpenAiReceiptExtractionAdapter(env.get('OPENAI_API_KEY', ''))
    case 'ollama':
      return new OllamaReceiptExtractionAdapter(
        env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
        env.get('OLLAMA_VISION_MODEL', ''),
      )
  }
}

/**
 * Cheap DB read on every call (via `settings.resolveEffective()`), no
 * adapter rebuild unless `activeProvider` actually changed — same
 * hot-reload mechanism `arr` uses for `getAuthInstance`
 * (`~/dev/arr/backend/src/infrastructure/auth/better-auth/instance.ts:163-181`).
 */
export async function resolveReceiptExtractionAdapter(
  settings: AiSettingsProvider,
): Promise<ReceiptExtractionPort> {
  if (testOverride) return testOverride

  const effective = await settings.resolveEffective()
  if (!cached || cached.signature !== effective.activeProvider) {
    cached = {
      adapter: buildAdapter(effective.activeProvider),
      signature: effective.activeProvider,
    }
  }
  return cached.adapter
}
