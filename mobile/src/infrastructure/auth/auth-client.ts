import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'
import { getServerUrl, onServerUrlChange } from '../http/server-config.js'

function buildClient() {
  return createAuthClient({
    baseURL: getServerUrl(),
    plugins: [
      expoClient({
        scheme: 'gardemanger',
        storage: SecureStore,
        storagePrefix: 'gardemanger',
      }),
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
