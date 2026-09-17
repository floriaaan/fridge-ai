/**
 * The chosen backend URL — set once during onboarding (see server-choice
 * screen), changeable later from Réglages. Falls back to the build-time
 * `EXPO_PUBLIC_API_URL` when nothing has been chosen yet (existing installs,
 * dev builds). Persisted through `app-storage`, same mechanism as every
 * other local flag.
 */
import Constants from 'expo-constants'
import { clearSetting, readSetting, writeSetting } from '../../presentation/shared/app-storage.js'

const SERVER_URL_KEY = 'server_url'
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? ''

// ponytail: hardcoded until the official SaaS offering actually exists —
// not env-driven, since there is exactly one and every build should agree
// on it. Test value for now; swap for the real address once it's live.
export const OFFICIAL_SERVER_URL = 'http://192.168.1.82:3333'

/** `expo.version` from app.json — what a self-hosted instance's reported version gets compared against. */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0'

// ponytail: no store listing exists yet (app.json has no bundleIdentifier/package),
// so there's nowhere real to send someone for an update. Empty for now —
// set to the real App Store / Play Store URL once the app is published.
export const APP_UPDATE_URL = ''

let currentUrl = DEFAULT_URL
const listeners: Array<(url: string) => void> = []

export function getServerUrl(): string {
  return currentUrl
}

export function getDefaultServerUrl(): string {
  return DEFAULT_URL
}

/**
 * Call once at app boot, before anything reads `getServerUrl()` for real —
 * `_layout.tsx` gates the first render on this. Notifies listeners even on
 * this first load: `auth-client.ts` builds its client at module-import time
 * (synchronously, against whatever `currentUrl` was then), so it needs this
 * same rebuild signal to pick up a stored URL that resolved after that.
 */
export async function loadStoredServerUrl(): Promise<void> {
  currentUrl = (await readSetting(SERVER_URL_KEY)) ?? DEFAULT_URL
  listeners.forEach((listener) => listener(currentUrl))
}

export async function setServerUrl(url: string): Promise<void> {
  await writeSetting(SERVER_URL_KEY, url)
  currentUrl = url
  listeners.forEach((listener) => listener(url))
}

/** Dev-only "reset app state" escape hatch (Réglages' Debug menu) — drops the chosen server back to `DEFAULT_URL` so `/server-choice` starts fresh instead of pre-picked. */
export async function clearServerUrl(): Promise<void> {
  await clearSetting(SERVER_URL_KEY)
  currentUrl = DEFAULT_URL
  listeners.forEach((listener) => listener(currentUrl))
}

/** Lets `auth-client.ts` rebuild its client when the server changes — better-auth bakes `baseURL` in at creation, so there is no other way to point it elsewhere. */
export function onServerUrlChange(listener: (url: string) => void): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index !== -1) listeners.splice(index, 1)
  }
}
