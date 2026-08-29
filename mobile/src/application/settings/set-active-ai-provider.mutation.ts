import { defineMutation } from '../shared/define-mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

export const useSetActiveAiProviderMutation = defineMutation((connector, provider: AiProvider) =>
  connector.setActiveAiProvider(provider),
)
