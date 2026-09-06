/**
 * One small key/value store that answers on all three platforms.
 *
 * `expo-secure-store` is already a dependency (it backs the auth client's
 * session storage) but it has **no web implementation** — calling it from a
 * browser build throws rather than returning null, so a screen that stored a
 * flag through it would work on a phone and crash the web build silently
 * inside a promise nobody awaited. Web falls back to `localStorage`.
 *
 * Every call is wrapped: a private window, a locked keychain, or storage
 * disabled by policy must degrade to "we don't know", never to a thrown error
 * on a first-run path. "We don't know" is the safe answer for everything kept
 * here — a tour shows again, a remembered invite code is simply retyped.
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const IS_WEB = Platform.OS === 'web'

export async function readSetting(key: string): Promise<string | null> {
  try {
    if (IS_WEB) return globalThis.localStorage?.getItem(key) ?? null
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  try {
    if (IS_WEB) globalThis.localStorage?.setItem(key, value)
    else await SecureStore.setItemAsync(key, value)
  } catch {
    // A flag we could not persist costs a repeated tour, not a broken screen.
  }
}

export async function clearSetting(key: string): Promise<void> {
  try {
    if (IS_WEB) globalThis.localStorage?.removeItem(key)
    else await SecureStore.deleteItemAsync(key)
  } catch {
    // Same trade as above.
  }
}
