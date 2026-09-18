import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import { passkeyClient } from '@better-auth/passkey/client'
import * as SecureStore from 'expo-secure-store'
import { getServerUrl, onServerUrlChange } from '../../application/shared/server-config.js'

function buildClient() {
  return createAuthClient({
    baseURL: getServerUrl(),
    plugins: [
      expoClient({
        scheme: 'gardemanger',
        storage: SecureStore,
        storagePrefix: 'gardemanger',
      }),
      // Only `listUserPasskeys` is called from the app today (account
      // screen's linked-methods list) — `signIn.passkey`/`addPasskey` call
      // into `@simplewebauthn/browser`'s `navigator.credentials`, which
      // doesn't exist in React Native. Registering/authenticating with an
      // actual passkey needs a native WebAuthn bridge (e.g.
      // react-native-passkeys) plus HTTPS-hosted domain association files,
      // not wired up here — cf. conversation notes.
      passkeyClient(),
    ],
  })
}

let client = buildClient()
// better-auth bakes `baseURL` into the client at creation, so changing
// server (Réglages > Changer de serveur) rebuilds it from scratch — this
// proxy is what lets every existing `authClient.foo()` call site keep
// working across that swap without threading a getter through all of them.
onServerUrlChange(() => {
  client = buildClient()
})

export const authClient = new Proxy({} as ReturnType<typeof buildClient>, {
  get(_target, prop) {
    return Reflect.get(client, prop)
  },
})
