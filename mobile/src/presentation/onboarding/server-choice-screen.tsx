/**
 * Between `/welcome` and `/(auth)/sign-up` on a first launch — see
 * `app/welcome.tsx` and `app/server-choice.tsx`. "Hébergé" is disabled: the
 * landing page's own FAQ says that offering isn't open yet. "Mon serveur"
 * pings `/api/public/instance` before saving anything, so a typo or a
 * non-Garde-manger URL never gets silently accepted.
 */
import { useState } from 'react'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { setServerUrl, getDefaultServerUrl } from '../../infrastructure/http/server-config.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthField } from '../identity/auth-field.js'
import { AuthError } from '../identity/auth-error.js'
import { AuthShell } from '../identity/auth-shell.js'
import type { InstanceInfo } from '../../domain/instance/instance-info.js'

export function ServerChoiceScreen({ onDone }: { onDone: () => void }) {
  const palette = useSoftPalette()
  const connector = useConnector()
  const [url, setUrl] = useState(getDefaultServerUrl())
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<InstanceInfo | null>(null)

  async function handleCheck() {
    setError(null)
    setFound(null)
    const trimmed = url.trim().replace(/\/+$/, '')
    if (!trimmed) return
    setChecking(true)
    const info = await connector.getInstanceInfo(trimmed)
    setChecking(false)
    if (!info) {
      setError("Ce serveur ne répond pas comme une instance Garde-manger. Vérifie l'adresse.")
      return
    }
    setUrl(trimmed)
    setFound(info)
  }

  async function handleConfirm() {
    await setServerUrl(url)
    onDone()
  }

  return (
    <AuthShell
      title="Choisis ton serveur"
      subtitle="Garde-manger peut être auto-hébergé, ou, bientôt, hébergé par nous."
    >
      <YStack gap="$4">
        <YStack borderRadius={16} padding="$3" backgroundColor={palette.gradientBottom} opacity={0.5} gap="$1">
          <Text fontSize={14} fontWeight="800" color={palette.onDark}>
            Hébergé
          </Text>
          <Text fontSize={12} fontWeight="500" color={palette.onDarkSecondary}>
            Bientôt disponible.
          </Text>
        </YStack>

        <YStack gap="$2">
          <Text fontSize={14} fontWeight="800" color={palette.onDark}>
            Mon serveur
          </Text>
          <AuthField
            label="Adresse du serveur"
            labelColor={palette.onDarkSecondary}
            placeholder="https://mon-serveur.exemple.com"
            value={url}
            onChangeText={(next) => {
              setUrl(next)
              setFound(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="server-choice-url"
          />
        </YStack>

        {error ? <AuthError message={error} /> : null}

        {found ? (
          <YStack borderRadius={14} padding="$3" backgroundColor={palette.mintPale} gap="$1">
            <Text testID="server-choice-found" fontSize={13} fontWeight="700" color={palette.mintPaleText}>
              {found.name ? `${found.name} — v${found.version}` : `Serveur trouvé — v${found.version}`}
            </Text>
          </YStack>
        ) : null}

        <AuthButton
          testID="server-choice-check"
          label="Vérifier"
          pendingLabel="Vérification..."
          pending={checking}
          disabled={!url.trim()}
          onPress={handleCheck}
        />
        {found ? (
          <AuthButton testID="server-choice-confirm" label="Utiliser ce serveur" onPress={handleConfirm} />
        ) : null}
      </YStack>
    </AuthShell>
  )
}
