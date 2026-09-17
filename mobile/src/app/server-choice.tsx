import { router, useLocalSearchParams } from 'expo-router'
import { ServerChoiceScreen as ServerChoicePresentation } from '../presentation/onboarding/server-choice-screen.js'

/**
 * A route-root screen, same reason `welcome.tsx` is one — no session, no
 * tab, nothing to gate on but the same first-launch flag. Sits between
 * `/welcome` and `/(auth)/sign-up`: `welcome.tsx`'s "Commencer"/"Passer"
 * routes here instead of straight to sign-up, and this screen is what
 * finally lands on sign-up once a server is chosen.
 *
 * Also reached from Réglages ("Changer de serveur"), which passes
 * `?next=sign-in` — that visitor already has an account on some server and
 * should land back on sign-in, not sign-up.
 */
export default function ServerChoiceRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  return (
    <ServerChoicePresentation
      onDone={() => router.replace(next === 'sign-in' ? '/(auth)/sign-in' : '/(auth)/sign-up')}
    />
  )
}
