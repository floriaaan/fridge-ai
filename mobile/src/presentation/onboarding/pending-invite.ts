/**
 * The code that arrived before the account did.
 *
 * Someone taps a `fridgeai://join?code=…` link on a phone where nobody is
 * signed in. The route they land on cannot use the code — there is no account
 * to attach a foyer to — and the redirect chain that sends them to sign-up
 * would drop a route parameter along the way. So the code waits here, and the
 * threshold screen picks it up once an account exists.
 *
 * Persisted rather than held in a module variable: the sign-up path can go
 * out to PocketID in a browser and come back through a cold start, and a code
 * that only survived the current JS context would be gone exactly when the
 * flow is longest. Read-and-clear, so a code is offered once and never
 * re-pre-fills a field the user has already cleared on purpose.
 */
import { clearSetting, readSetting, writeSetting } from '../shared/app-storage.js'
import { normalizeInviteCode, isCompleteInviteCode } from '../../domain/identity/invite-code.js'

const KEY = 'fridge-ai.pending-invite-code'

export async function rememberInviteCode(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code)
  if (!isCompleteInviteCode(normalized)) return
  await writeSetting(KEY, normalized)
}

export async function takeInviteCode(): Promise<string | null> {
  const stored = await readSetting(KEY)
  if (stored) await clearSetting(KEY)
  return stored && isCompleteInviteCode(stored) ? stored : null
}
