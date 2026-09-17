import { useState } from 'react'
import { Pressable } from 'react-native'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { AuthField } from '../identity/auth-field.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthError } from '../identity/auth-error.js'
import { useConnector } from '../../application/shared/connector-context.js'
import { getDefaultServerUrl } from '../../infrastructure/http/server-config.js'
import type { InstanceInfo } from '../../domain/instance/instance-info.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

type Mode = 'official' | 'self-hosted'

function RadioOption({
  testID,
  palette,
  selected,
  disabled,
  title,
  subtitle,
  onPress,
}: {
  testID?: string
  palette: SoftPalette
  selected: boolean
  disabled?: boolean
  title: string
  subtitle: string
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <XStack
        alignItems="flex-start"
        gap="$3"
        borderRadius={18}
        borderWidth={2}
        borderColor={selected ? palette.chipTeal : 'transparent'}
        padding="$4"
        backgroundColor={palette.gradientBottom}
        opacity={disabled ? 0.5 : 1}
      >
        <YStack
          marginTop={2}
          width={22}
          height={22}
          borderRadius={11}
          backgroundColor={selected ? palette.chipTeal : palette.creamPillEdge}
          alignItems="center"
          justifyContent="center"
        >
          {selected ? <YStack width={9} height={9} borderRadius={5} backgroundColor={palette.onDark} /> : null}
        </YStack>
        <YStack flex={1} gap={4}>
          <Text fontSize={15} fontWeight="800" color={palette.ink}>
            {title}
          </Text>
          <Text fontSize={13} fontWeight="500" lineHeight={18} color={palette.inkSecondary}>
            {subtitle}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  )
}

/**
 * The radio-card + self-host form shared between onboarding
 * (`server-choice-screen.tsx`) and Réglages' "Changer de serveur" page — one
 * place for the "official instance vs self-host" choice and the
 * verify-then-save flow, so a change to either applies to both rather than
 * drifting between two hand-copied forms.
 *
 * "Officiel" stays disabled (that offering isn't open yet, per the landing
 * page's FAQ) — the radio still shows it as a real, if unavailable, choice
 * rather than hiding it. Self-hosted is the only selectable mode today, so
 * it starts selected. The single submit button is "Vérifier" until a check
 * succeeds, then becomes `saveLabel` — editing the URL after a successful
 * check drops back to "Vérifier", since the verified server is no longer
 * the one in the field.
 */
export function ServerChoiceForm({
  palette,
  defaultUrl,
  saveLabel = 'Sauvegarder',
  fieldLabelColor,
  onSave,
}: {
  palette: SoftPalette
  defaultUrl?: string
  saveLabel?: string
  fieldLabelColor?: string
  onSave: (url: string, info: InstanceInfo) => void | Promise<void>
}) {
  const connector = useConnector()
  const [mode, setMode] = useState<Mode>('self-hosted')
  const [url, setUrl] = useState(defaultUrl ?? getDefaultServerUrl())
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState<InstanceInfo | null>(null)

  async function handleVerify() {
    setError(null)
    setVerified(null)
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
    setVerified(info)
  }

  async function handleSave() {
    if (!verified) return
    setSaving(true)
    try {
      await onSave(url, verified)
    } finally {
      setSaving(false)
    }
  }

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <RadioOption
          testID="server-choice-official"
          palette={palette}
          selected={mode === 'official'}
          disabled
          title="Garde-manger officiel"
          subtitle="Notre serveur, prêt à l'emploi, sans rien à installer ni à maintenir. Bientôt disponible."
          onPress={() => setMode('official')}
        />
        <RadioOption
          testID="server-choice-self-hosted"
          palette={palette}
          selected={mode === 'self-hosted'}
          title="Auto-hébergé"
          subtitle="Connecte-toi à ton propre serveur Garde-manger : tu gardes la main sur tes données et leur hébergement."
          onPress={() => setMode('self-hosted')}
        />
      </YStack>

      {mode === 'self-hosted' ? (
        <YStack gap="$3">
          <AuthField
            label="Adresse du serveur"
            labelColor={fieldLabelColor}
            placeholder="https://mon-serveur.exemple.com"
            value={url}
            onChangeText={(next) => {
              setUrl(next)
              setVerified(null)
              setError(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="server-choice-url"
          />

          {error ? <AuthError message={error} /> : null}

          {verified ? (
            <YStack borderRadius={14} padding="$3" backgroundColor={palette.mintPale} gap="$1">
              <Text testID="server-choice-found" fontSize={13} fontWeight="700" color={palette.mintPaleText}>
                {verified.name ? `${verified.name} — v${verified.version}` : `Serveur trouvé — v${verified.version}`}
              </Text>
            </YStack>
          ) : null}

          <AuthButton
            testID="server-choice-submit"
            label={verified ? saveLabel : 'Vérifier'}
            pendingLabel={verified ? 'Sauvegarde...' : 'Vérification...'}
            pending={verified ? saving : checking}
            disabled={!url.trim()}
            onPress={verified ? handleSave : handleVerify}
          />
        </YStack>
      ) : null}
    </YStack>
  )
}
