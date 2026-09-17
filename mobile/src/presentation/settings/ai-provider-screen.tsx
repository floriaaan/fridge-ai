/**
 * Réglages > Intelligence artificielle > provider picker — its own page
 * (2026-09-18) rather than a footer inline on the Réglages card: the model
 * names (`settings-ai-models`) and the provider chips are the kind of
 * technical detail Réglages itself stopped showing (cf. Serveur card).
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { Chip } from '../shared/chip.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { SparklesIcon } from '../dashboard/dashboard-icons.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }

export function AiProviderScreen() {
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()
  const queryClient = useQueryClient()
  const [providerError, setProviderError] = useState<string | null>(null)

  const availableProviders = settings.data?.availableProviders ?? []
  // The gate is `availableProviders`, never `source`. `source` only records
  // whether anyone has picked yet (`env-ai-settings-provider.ts`: a stored row
  // wins, env is the first-boot fallback), so reading it as "the administrator
  // configured this" described a lock that does not exist — the foyer can
  // change the provider whenever more than one has credentials.
  const canChooseProvider = availableProviders.length > 1

  async function handleSelectProvider(provider: AiProvider) {
    if (settings.data?.activeProvider === provider) {
      return
    }
    setProviderError(null)
    const result = await setProvider.mutateAsync(provider)
    if (!result.ok) {
      setProviderError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <SparklesIcon size={19} color={color} />}
          title="Intelligence artificielle"
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$2" marginTop="$5">
        <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
          Lit tes tickets de caisse et invente tes recettes.
        </Text>

        {canChooseProvider ? (
          <XStack gap="$3" flexWrap="wrap" marginTop="$2">
            {availableProviders.map((provider) => (
              <Chip
                key={provider}
                testID={`ai-provider-${provider}`}
                label={PROVIDER_LABELS[provider]}
                selected={settings.data?.activeProvider === provider}
                onPress={() => handleSelectProvider(provider)}
                palette={palette}
              />
            ))}
          </XStack>
        ) : null}
        {setProvider.isPending ? (
          // The mutation had no visible state at all: on a slow connection a
          // tap on "Ollama" produced nothing until the invalidation landed.
          <Text fontSize={12} fontWeight="600" color={palette.lavenderText} accessibilityLiveRegion="polite">
            Changement en cours…
          </Text>
        ) : null}
        {settings.data && availableProviders.length === 0 ? (
          // `activeProvider` can name a provider whose key is gone — the picker
          // then drew an empty row and no selection, explaining nothing.
          <Text fontSize={13} color={palette.expiredText}>
            Aucun fournisseur n’est configuré sur ce serveur.
          </Text>
        ) : null}
        {!settings.isPending && !settings.data ? (
          <Text fontSize={13} color={palette.expiredText}>
            Impossible de charger les réglages.
          </Text>
        ) : null}
        {providerError ? (
          <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
            {providerError}
          </Text>
        ) : null}
        {settings.data?.models.vision ? (
          <Text testID="settings-ai-models" fontSize={12} fontWeight="600" color={palette.inkSecondary}>
            Vision : {settings.data.models.vision} · Texte : {settings.data.models.text}
          </Text>
        ) : null}
      </YStack>
    </AppShell>
  )
}
