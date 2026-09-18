/**
 * Réglages > Intelligence artificielle > provider picker — its own page
 * (2026-09-18) rather than a footer inline on the Réglages card: the model
 * names (`settings-ai-models`) and the provider chips are the kind of
 * technical detail Réglages itself stopped showing (cf. Serveur card).
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { RadioCard } from '../shared/radio-card.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { SparklesIcon } from '../dashboard/dashboard-icons.js'
import { GeminiIcon } from './gemini-icon.js'
import { OpenAiIcon } from './openai-icon.js'
import { OllamaIcon } from './ollama-icon.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }

const PROVIDER_TINTS: Record<AiProvider, string> = { gemini: '#4C8DF6', openai: '#10A37F', ollama: '#1A1A1A' }

const PROVIDER_DESCRIPTIONS: Record<AiProvider, string> = {
  gemini: 'Modèle de Google, envoyé à leurs serveurs.',
  openai: 'Modèle d’OpenAI, envoyé à leurs serveurs.',
  ollama: 'Modèle exécuté sur ton propre serveur, rien n’en sort.',
}

function ProviderIcon({ provider, color }: { provider: AiProvider; color: string }) {
  switch (provider) {
    case 'gemini':
      return <GeminiIcon size={17} color={color} />
    case 'openai':
      return <OpenAiIcon size={17} color={color} />
    case 'ollama':
      return <OllamaIcon size={17} />
  }
}

export function AiProviderScreen() {
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()
  const queryClient = useQueryClient()
  const [providerError, setProviderError] = useState<string | null>(null)

  const availableProviders = settings.data?.availableProviders ?? []
  const lockedProviders = settings.data?.lockedProviders ?? []
  // The gate is `availableProviders`, never `source`. `source` only records
  // whether anyone has picked yet (`env-ai-settings-provider.ts`: a stored row
  // wins, env is the first-boot fallback), so reading it as "the administrator
  // configured this" described a lock that does not exist — the foyer can
  // change the provider whenever more than one has credentials.
  //
  // Paywalled providers are drawn alongside, locked rather than hidden: a
  // Gemini that vanishes because the abonnement lapsed is indistinguishable
  // from a Gemini nobody configured, and only one of the two is actionable.
  const canChooseProvider = availableProviders.length + lockedProviders.length > 1

  async function handleSelectProvider(provider: AiProvider) {
    if (settings.data?.activeProvider === provider) {
      return
    }
    if (lockedProviders.includes(provider)) {
      setProviderError(`${PROVIDER_LABELS[provider]} nécessite un abonnement actif.`)
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
          <Text fontSize={12} color={palette.inkSecondary}>
            Le fournisseur choisi vaut pour tout le foyer, pas seulement toi.
          </Text>
        ) : null}

        {canChooseProvider ? (
          <YStack gap="$2" marginTop="$2">
            {[...availableProviders, ...lockedProviders].map((provider) => (
              <RadioCard
                key={provider}
                testID={`ai-provider-${provider}`}
                label={PROVIDER_LABELS[provider]}
                description={
                  lockedProviders.includes(provider) ? 'Nécessite un abonnement actif' : PROVIDER_DESCRIPTIONS[provider]
                }
                selected={settings.data?.activeProvider === provider}
                onPress={() => handleSelectProvider(provider)}
                icon={(color) => <ProviderIcon provider={provider} color={color} />}
                iconTint={PROVIDER_TINTS[provider]}
                palette={palette}
              />
            ))}
          </YStack>
        ) : null}
        {setProvider.isPending ? (
          // The mutation had no visible state at all: on a slow connection a
          // tap on "Ollama" produced nothing until the invalidation landed.
          <Text fontSize={12} fontWeight="600" color={palette.lavenderText} accessibilityLiveRegion="polite">
            Changement en cours…
          </Text>
        ) : null}
        {settings.data && availableProviders.length === 0 && lockedProviders.length === 0 ? (
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
