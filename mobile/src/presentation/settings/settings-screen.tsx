import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }
const SOURCE_LABELS: Record<'database' | 'environment', string> = {
  environment: "Configuré par l'administrateur",
  database: 'Choisi par le foyer',
}

export function SettingsScreen() {
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()
  const queryClient = useQueryClient()

  async function handleSelectProvider(provider: AiProvider) {
    if (settings.data?.activeProvider === provider) {
      return
    }
    await setProvider.mutateAsync(provider)
    queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
  }

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$4">
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            Réglages
          </Text>

          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700" color={palette.ink}>
              Fournisseur IA
            </Text>
            {settings.data?.availableProviders.map((provider) => {
              const selected = settings.data?.activeProvider === provider
              return (
                <Pressable
                  key={provider}
                  testID={`ai-provider-${provider}`}
                  onPress={() => handleSelectProvider(provider)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={pointerCursor}
                >
                  <YStack
                    backgroundColor={selected ? palette.accentLime : palette.mintPale}
                    borderRadius={16}
                    padding="$3"
                  >
                    <Text fontSize={14} fontWeight="700" color={selected ? palette.accentLimeText : palette.mintPaleText}>
                      {PROVIDER_LABELS[provider]}
                    </Text>
                  </YStack>
                </Pressable>
              )
            })}
            {settings.data ? (
              <Text fontSize={12} color={palette.inkSecondary}>
                {SOURCE_LABELS[settings.data.source]}
              </Text>
            ) : null}
          </YStack>

          <Pressable
            testID="settings-receipts-history"
            onPress={() => router.push('/(tabs)/receipts')}
            accessibilityRole="button"
            accessibilityLabel="Historique des tickets"
            style={pointerCursor}
          >
            <Text fontSize={14} fontWeight="700" color={palette.mintPaleText}>
              Historique des tickets
            </Text>
          </Pressable>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
