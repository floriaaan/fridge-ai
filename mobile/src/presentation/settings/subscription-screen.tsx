/**
 * Réglages > Abonnement (ADR 0014). Three states off `access.plan`:
 * self-hosted → not applicable (nothing to buy, AI is unlimited on your own
 * server); free → the paywall; subscriber → what is active and until when.
 */
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { BadgeCheckIcon } from '../dashboard/dashboard-icons.js'
import { AiQuotaHint, SubscriptionPaywall } from './ai-access-cards.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'

export function SubscriptionScreen() {
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const subscription = useAiSubscribe()
  const access = settings.data?.access

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <BadgeCheckIcon size={19} color={color} />}
          title="Abonnement"
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        {access?.plan === 'self-hosted' ? (
          <YStack testID="subscription-not-applicable" gap="$1.5" padding="$4" borderRadius="$4" backgroundColor={palette.gradientBottom}>
            <Text fontSize={16} fontWeight="800" color={palette.ink}>
              Non applicable
            </Text>
            <Text fontSize={13} color={palette.inkSecondary}>
              Tu utilises un serveur auto-hébergé : l’IA n’y est pas limitée et aucun abonnement n’est nécessaire.
            </Text>
          </YStack>
        ) : null}

        {access?.plan === 'free' ? (
          <SubscriptionPaywall
            palette={palette}
            onSubscribe={subscription.subscribe}
            pending={subscription.pending}
            error={subscription.error}
          />
        ) : null}

        {access?.plan === 'subscriber' ? (
          <YStack testID="subscription-active" gap="$1.5" padding="$4" borderRadius="$4" backgroundColor={palette.gradientBottom}>
            <Text fontSize={16} fontWeight="800" color={palette.ink}>
              Abonnement actif
            </Text>
            <Text fontSize={13} color={palette.inkSecondary}>
              L’IA est débloquée pour tout le foyer
              {access.expiresAt ? ` jusqu’au ${new Date(access.expiresAt).toLocaleDateString('fr-FR')}` : ''}.
              Gère ou résilie depuis ton compte App Store / Google Play.
            </Text>
          </YStack>
        ) : null}

        {access ? <AiQuotaHint access={access} palette={palette} /> : null}

        {!settings.isPending && !settings.data ? (
          <Text fontSize={13} color={palette.expiredText}>
            Impossible de charger l’abonnement.
          </Text>
        ) : null}
      </YStack>
    </AppShell>
  )
}
