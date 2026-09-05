import { useState } from 'react'
import { Animated, Pressable } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { BackButton } from '../shared/back-button.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChevronRightIcon, HomeIcon, LogOutIcon, ReceiptIcon, UserIcon } from '../dashboard/dashboard-icons.js'
import { StatCard } from '../dashboard/stat-card.js'
import { AuthButton } from '../identity/auth-button.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }
const SOURCE_LABELS: Record<'database' | 'environment', string> = {
  environment: "Configuré par l'administrateur",
  database: 'Choisi par le foyer',
}

function ProviderChip({
  label,
  active,
  onPress,
  palette,
  testID,
}: {
  label: string
  active: boolean
  onPress: () => void
  palette: SoftPalette
  testID: string
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        {/* minHeight 44: same touch-target floor as fridge's FilterChip. */}
        <XStack
          backgroundColor={active ? palette.accentLime : palette.mintPale}
          borderRadius={999}
          paddingVertical="$2.5"
          paddingHorizontal="$4"
          minHeight={44}
          alignItems="center"
        >
          <Text fontSize={13} fontWeight="700" color={active ? palette.accentLimeText : palette.mintPaleText}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

function SectionLabel({ children, palette }: { children: string; palette: SoftPalette }) {
  return (
    <Text fontSize={15} fontWeight="800" color={palette.ink}>
      {children}
    </Text>
  )
}

// A pushed screen (reached from the dashboard's "Réglages" link), not one
// of the four tabs — so `AppShell`'s `{ kind: 'stack' }` nav: no bottom
// tab nav, a BackButton in the header instead (same convention recipe/
// shopping-list already used), still the full BlobBackground + tablet/
// desktop Sidebar shell everywhere else gets. An audit found this screen
// had none of that — no shell at all, not even a way back on mobile
// except the OS gesture.
//
// Redesigned (2026-08-30) to feel as crafted as the dashboard: the same
// pastel StatCard language for account/household identity, the same chip
// pattern as the fridge's location filters for the provider picker, a
// tappable row instead of a bare text link for receipts history, and
// sign-out as a real secondary `AuthButton` — moved here from the
// dashboard header's small text link, its one home now.
export function SettingsScreen() {
  const palette = useSoftPalette()
  const session = useSessionQuery()
  const household = useHouseholdQuery()
  const signOut = useSignOutMutation()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()
  const queryClient = useQueryClient()
  const [providerError, setProviderError] = useState<string | null>(null)
  const receiptsHover = useHoverPress()

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

  async function handleSignOut() {
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const signOutError = signOut.error ? 'Une erreur est survenue lors de la déconnexion.' : null
  const memberCount = household.data?.members.length ?? 0
  const memberSummary = memberCount > 0 ? `${memberCount} membre${memberCount > 1 ? 's' : ''}` : undefined

  return (
    <AppShell nav={{ kind: 'stack' }}>
      <XStack alignItems="center" gap="$3">
        <BackButton onPress={() => router.back()} ink={palette.ink} cream={palette.cream} />
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          Réglages
        </Text>
      </XStack>

      <XStack gap="$3" marginTop="$5">
        <StatCard
          bg={palette.cream}
          labelColor={palette.creamText}
          valueColor={palette.ink}
          chipColor={palette.chipOrange}
          icon={<UserIcon size={18} color={palette.onDark} />}
          label="Compte"
          value={session.data?.user.name || '—'}
          secondary={session.data?.user.email}
          corner="a"
          palette={palette}
        />
        <Pressable
          testID="settings-household"
          onPress={() => router.push('/(tabs)/household')}
          accessibilityRole="button"
          accessibilityLabel="Gérer le foyer"
          style={[pointerCursor, { flex: 1 }]}
        >
          <StatCard
            bg={palette.mintPale}
            labelColor={palette.mintPaleText}
            valueColor={palette.ink}
            chipColor={palette.chipTeal}
            icon={<HomeIcon size={18} color={palette.onDark} />}
            label="Foyer"
            value={household.isPending ? '—' : (household.data?.name ?? 'Aucun foyer')}
            secondary={memberSummary ? `${memberSummary} · gérer` : 'Gérer'}
            corner="b"
            palette={palette}
          />
        </Pressable>
      </XStack>

      <YStack marginTop="$6" gap="$2">
        <SectionLabel palette={palette}>Fournisseur IA</SectionLabel>
        <XStack gap="$2" flexWrap="wrap">
          {settings.data?.availableProviders.map((provider) => (
            <ProviderChip
              key={provider}
              testID={`ai-provider-${provider}`}
              label={PROVIDER_LABELS[provider]}
              active={settings.data?.activeProvider === provider}
              onPress={() => handleSelectProvider(provider)}
              palette={palette}
            />
          ))}
        </XStack>
        {settings.data ? (
          <Text fontSize={12} color={palette.inkSecondary}>
            {SOURCE_LABELS[settings.data.source]}
          </Text>
        ) : null}
        {!settings.isPending && !settings.data ? (
          <Text fontSize={13} color={palette.expiredText}>
            Impossible de charger les réglages.
          </Text>
        ) : null}
        {providerError ? (
          <Text fontSize={13} color={palette.expiredText}>
            {providerError}
          </Text>
        ) : null}
      </YStack>

      <YStack marginTop="$6" gap="$2">
        <SectionLabel palette={palette}>Données</SectionLabel>
        <Pressable
          testID="settings-receipts-history"
          onPress={() => router.push('/(tabs)/receipts')}
          onHoverIn={receiptsHover.onHoverIn}
          onHoverOut={receiptsHover.onHoverOut}
          onPressIn={receiptsHover.onPressIn}
          onPressOut={receiptsHover.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Historique des tickets"
          style={pointerCursor}
        >
          <Animated.View style={{ transform: [{ scale: receiptsHover.scale }] }}>
            <XStack
              alignItems="center"
              gap="$3"
              backgroundColor={palette.gradientBottom}
              borderRadius={16}
              padding="$3"
              minHeight={44}
              style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
            >
              <YStack width={36} height={36} borderRadius={12} backgroundColor={palette.chipViolet} alignItems="center" justifyContent="center">
                <ReceiptIcon size={18} color={palette.onDark} />
              </YStack>
              <Text fontSize={14} fontWeight="700" color={palette.ink} flex={1}>
                Historique des tickets
              </Text>
              <ChevronRightIcon size={18} color={palette.inkSecondary} />
            </XStack>
          </Animated.View>
        </Pressable>
      </YStack>

      <YStack marginTop="$8" gap="$2">
        <AuthButton
          testID="sign-out"
          label="Se déconnecter"
          pendingLabel="Déconnexion..."
          pending={signOut.isPending}
          variant="secondary"
          icon={<LogOutIcon size={16} color={palette.ink} />}
          onPress={handleSignOut}
        />
        {signOutError ? (
          <Text fontSize={13} color={palette.expiredText}>
            {signOutError}
          </Text>
        ) : null}
      </YStack>
    </AppShell>
  )
}
