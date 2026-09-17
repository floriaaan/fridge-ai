/**
 * The chosen backend URL — set once during onboarding (see server-choice
 * screen), changeable later from Réglages. Falls back to the build-time
 * `EXPO_PUBLIC_API_URL` when nothing has been chosen yet (existing installs,
 * dev builds). Persisted through `app-storage`, same mechanism as every
 * other local flag.
 */
import { readSetting, writeSetting } from '../../presentation/shared/app-storage.js'

const SERVER_URL_KEY = 'server_url'
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? ''

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

/** Lets `auth-client.ts` rebuild its client when the server changes — better-auth bakes `baseURL` in at creation, so there is no other way to point it elsewhere. */
export function onServerUrlChange(listener: (url: string) => void): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index !== -1) listeners.splice(index, 1)
  }
}
