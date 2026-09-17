import { router } from 'expo-router'
import { WelcomeScreen as WelcomePresentation } from '../presentation/welcome/welcome-screen.js'
import { markWelcomeSeen } from '../presentation/welcome/use-welcome-seen.js'

/**
 * A route-root screen (not under `(tabs)/`), the same reason `settings`,
 * `household` and `receipts` sit here — a screen with no tab to highlight
 * needs no `NativeTabs` trigger to route through. `(tabs)/_layout.tsx` is
 * the gate: it redirects here on any device that has not yet marked the
 * flag seen, and never again once it has.
 *
 * One screen, one button — "Commencer" marks the flag and leaves in the
 * same motion, onward to `/server-choice` (which itself lands on sign-up,
 * not sign-in: every visitor who reaches this screen has, by construction,
 * never used the app on this device before — the flag this screen sets is
 * the only thing standing between a fresh install and seeing it again.
 * Landing that visitor on sign-in's "Content de te revoir" greeted them as a
 * returning user on their actual first visit, a real critique finding, and
 * buried the form they needed behind a 13px "Pas de compte ?" link).
 */
export default function WelcomeScreen() {
  async function finish() {
    await markWelcomeSeen()
    router.replace('/server-choice')
  }

  return <WelcomePresentation onDone={finish} />
}
