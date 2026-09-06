import { router, useLocalSearchParams } from 'expo-router'
import { ThresholdScreen } from '../../presentation/onboarding/threshold-screen.js'
import { parseInviteCode } from '../../presentation/onboarding/join-link.js'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function OnboardingScreen() {
  const session = useSessionQuery()
  // `code` arrives from `/join` (a deep link) and from the QR scanner, which
  // dismisses back onto this screen with the parameter set rather than opening
  // a second copy of it.
  const { code } = useLocalSearchParams<{ code?: string }>()

  return (
    <ThresholdScreen
      userName={session.data?.user.name ?? ''}
      prefillCode={parseInviteCode(code)}
      // The layout above is the gate: once `['household']` answers with a
      // foyer it redirects, so this screen never navigates into the tabs
      // itself and the two can never disagree about who is in charge.
      onEnteredHousehold={() => router.replace('/(tabs)')}
      onScanCode={() => router.push('/(onboarding)/scan-code')}
      onSignedOut={() => router.replace('/(auth)/sign-in')}
    />
  )
}
