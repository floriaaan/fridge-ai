/**
 * The three things the AI provider screen can show instead of a picker,
 * depending on `AiSettings.access.plan` and `canChooseProvider`:
 * - self-hosted, no provider configured → point at the setup guide.
 * - hosted, not subscribed → suggest the subscription.
 * - anyone with a capped quota → say how much is left.
 */
import { Linking, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { CircleCheckIcon, SparklesIcon } from '../dashboard/dashboard-icons.js'
import { useAiSubscribe } from '../../application/settings/use-ai-subscribe.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import type { AiAccess } from '../../domain/settings/ai-settings.js'

const SETUP_GUIDE_URL = 'https://github.com/floriaaan/fridge-ai/blob/main/README.fr.md#ia-scan-de-tickets-recettes'

export function AiSetupGuideCard({ palette }: { palette: SoftPalette }) {
  return (
    <YStack gap="$1.5" padding="$3" borderRadius="$4" backgroundColor={palette.gradientBottom}>
      <Text fontSize={14} fontWeight="700" color={palette.ink}>
        Aucun fournisseur IA configuré
      </Text>
      <Text fontSize={13} color={palette.inkSecondary}>
        Le scan de tickets et les recettes ont besoin d’une clé (Gemini, OpenAI) ou d’un modèle Ollama local sur ce
        serveur.
      </Text>
      <Pressable onPress={() => Linking.openURL(SETUP_GUIDE_URL)} testID="ai-setup-guide-link">
        <Text fontSize={13} fontWeight="700" color={palette.lavenderText}>
          Voir le guide de configuration
        </Text>
      </Pressable>
    </YStack>
  )
}

const PAYWALL_BENEFITS = ['Scan de tickets et de frigo', 'Recettes générées à volonté', 'Partagé avec tout le foyer']

/**
 * The one paywall — Réglages, the recipe sheet and both scan screens all
 * render this. Saturated card on purpose: it is the only place the app asks
 * for money, so it must not read as another pastel tile. `reason` says why it
 * showed up (quota spent) instead of a bare pitch.
 */
export function SubscriptionPaywall({
  palette,
  onSubscribe,
  pending,
  reason,
  error,
}: {
  palette: SoftPalette
  onSubscribe: () => void
  pending?: boolean
  reason?: string
  error?: string | null
}) {
  return (
    <YStack
      testID="subscription-paywall"
      overflow="hidden"
      style={{
        borderTopLeftRadius: 30,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 30,
        borderBottomLeftRadius: 16,
        shadowColor: palette.shadowCool,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={[palette.navCardViolet, palette.navCardTeal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <YStack padding="$4" gap="$3">
        <XStack alignItems="center" gap="$2.5">
          <YStack width={40} height={40} borderRadius={14} backgroundColor={palette.accentLime} alignItems="center" justifyContent="center">
            <SparklesIcon size={20} color={palette.accentLimeText} />
          </YStack>
          <Text flex={1} fontSize={13} fontWeight="700" color={palette.onDarkSecondary}>
            {reason ?? 'Garde-manger IA'}
          </Text>
        </XStack>

        <YStack>
          <Text fontSize={26} fontWeight="900" color={palette.onDark}>
            Débloque l’IA
          </Text>
          <XStack alignItems="baseline" gap="$1.5" marginTop="$1">
            <Text fontSize={40} fontWeight="900" color={palette.accentLime} lineHeight={44}>
              2€
            </Text>
            <Text fontSize={15} fontWeight="700" color={palette.onDarkSecondary}>
              par mois, pour tout le foyer
            </Text>
          </XStack>
        </YStack>

        <YStack gap="$1.5">
          {PAYWALL_BENEFITS.map((benefit) => (
            <XStack key={benefit} alignItems="center" gap="$2">
              <CircleCheckIcon size={16} color={palette.accentLime} />
              <Text fontSize={14} fontWeight="600" color={palette.onDark}>
                {benefit}
              </Text>
            </XStack>
          ))}
        </YStack>

        <Pressable
          onPress={onSubscribe}
          disabled={pending}
          testID="subscription-paywall-cta"
          accessibilityRole="button"
          accessibilityLabel="S’abonner pour 2 euros par mois"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <XStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$3" alignItems="center" justifyContent="center" gap="$2" minHeight={48}>
            <Text fontSize={16} fontWeight="900" color={palette.accentLimeText}>
              {pending ? 'Un instant…' : 'S’abonner'}
            </Text>
          </XStack>
        </Pressable>
        {error ? (
          <Text fontSize={12} fontWeight="600" color={palette.onDarkSecondary} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Text fontSize={11} fontWeight="500" color={palette.onDarkSecondary}>
          Résiliable à tout moment depuis le store. Usage raisonnable.
        </Text>
      </YStack>
    </YStack>
  )
}

/** Paywall wired to the purchase flow — drop it wherever an AI call just hit the free quota. Renders nothing off the free plan. */
export function ConnectedPaywall({ palette, reason }: { palette: SoftPalette; reason?: string }) {
  const { canSubscribe, subscribe, pending, error } = useAiSubscribe()
  if (!canSubscribe) return null
  return <SubscriptionPaywall palette={palette} onSubscribe={subscribe} pending={pending} reason={reason} error={error} />
}

export function AiQuotaHint({ access, palette }: { access: AiAccess; palette: SoftPalette }) {
  if (access.limit === null) return null
  const ratio = Math.min(access.used / access.limit, 1)
  const label = access.plan === 'free' ? 'Offre gratuite' : 'Abonnement'
  return (
    <YStack testID="ai-quota-hint" gap="$1.5" marginTop="$2">
      <XStack justifyContent="space-between">
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          {label}
        </Text>
        <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
          {access.used}/{access.limit} appels IA ce mois-ci
        </Text>
      </XStack>
      <YStack height={8} borderRadius={4} overflow="hidden" backgroundColor={palette.gradientBottom}>
        <YStack
          testID="ai-quota-bar"
          height={8}
          borderRadius={4}
          width={`${Math.round(ratio * 100)}%`}
          backgroundColor={ratio >= 1 ? palette.expiredText : palette.chipTeal}
        />
      </YStack>
    </YStack>
  )
}
