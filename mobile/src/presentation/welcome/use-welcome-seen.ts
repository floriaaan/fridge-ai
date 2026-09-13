/**
 * The pre-auth carousel's own persistent flag — separate from
 * `onboarding/use-first-run-tour.ts`'s, which arms *forward* (crossing the
 * household threshold arms a tour that fires once on the dashboard). This
 * one is read *backward*: the gate at `(tabs)/_layout.tsx` checks it on
 * every cold launch, before the session gate, and a device that has never
 * answered gets the carousel. Once `markWelcomeSeen()` has been awaited, the
 * carousel never renders again on this device — "Passer" and the last
 * slide's arrow both call it, so skipping and finishing are the same
 * outcome, not two different promises to the user.
 *
 * Armed on the device rather than the account for the same reason the tour
 * flag is: there is no session yet to hang it on when it matters most (a
 * fresh install), and a device that reinstalls sees the carousel again,
 * which is the honest behavior — nothing server-side remembers "this phone
 * already saw the pitch."
 */
import { useEffect, useState } from 'react'
import { clearSetting, readSetting, writeSetting } from '../shared/app-storage.js'

const KEY = 'fridge-ai.welcome.seen'

export async function markWelcomeSeen(): Promise<void> {
  await writeSetting(KEY, '1')
}

/**
 * Dev-only escape hatch (Réglages' Debug menu): clears the flag so the next
 * visit to "/" redirects into the carousel again, without reinstalling the
 * app. Production ships no button that calls this — the flag exists so the
 * carousel shows exactly once per device, and a user-facing reset would
 * contradict that on the first tap.
 */
export async function resetWelcomeSeen(): Promise<void> {
  await clearSetting(KEY)
}

/**
 * `null` while the flag is being read — the `(tabs)` gate renders nothing
 * for that one tick, the same "don't decide on a missing answer" rule
 * `session`/`household` already follow there, rather than flashing the
 * carousel at a returning member for the length of one keychain read.
 */
export function useHasSeenWelcome(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    readSetting(KEY).then((value) => {
      if (mounted) setSeen(value === '1')
    })
    return () => {
      mounted = false
    }
  }, [])

  return seen
}
