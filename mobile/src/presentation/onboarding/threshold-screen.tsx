/*
 * The threshold.
 *
 * One decision, at full screen: this account starts a foyer, or joins one that
 * already exists. Not a five-step corridor with a progress rail, and not a
 * carousel of four illustrated slides — the four sections introduce themselves
 * on the real dashboard afterwards (`first-run-tour.tsx`), where they are
 * actual controls rather than pictures of controls.
 *
 * The two branches are deliberately unequal. Creating carries the screen's one
 * dark surface (the mocha card, DESIGN.md's "sole high-contrast block" role,
 * ember glow and all); joining is the cream card beneath it. The weight says
 * which branch most people take without spending a word on it, and joining
 * loses nothing for it: its eight cells are right there on the card, not
 * behind a button that opens a second screen.
 *
 * There is no back button — the account already exists, and going "back" to
 * sign-up would be a lie. There is a way out: "Changer de compte" signs out.
 * A mandatory step with no exit is a trap, and the exit is what makes it a
 * gate instead.
 */
import { useEffect, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { PillButton } from '../shared/pill-button.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { AuthBlobBackground } from '../identity/auth-blob-background.js'
import { AuthButton } from '../identity/auth-button.js'
import { AuthError } from '../identity/auth-error.js'
import { AuthField } from '../identity/auth-field.js'
import { HeroWarmGlow } from '../dashboard/hero-warm-glow.js'
import { ClipboardIcon, QrCodeIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { InviteCodeField } from './invite-code-field.js'
import { parseInviteCode } from './join-link.js'
import { takeInviteCode } from './pending-invite.js'
import { armFirstRunTour } from './use-first-run-tour.js'
import { isCompleteInviteCode, normalizeInviteCode } from '../../domain/identity/invite-code.js'
import { useCreateHouseholdMutation } from '../../application/identity/create-household.mutation.js'
import { useJoinHouseholdMutation } from '../../application/identity/join-household.mutation.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { Result } from '../../domain/shared/result.js'
import type { Household } from '../../domain/identity/household.js'

export interface ThresholdScreenProps {
  /** Greeted by name, so the screen belongs to the account that just landed on it. */
  userName: string
  /** A code carried in by `fridgeai://join?code=…`, already validated by the route. */
  prefillCode?: string | null
  /** The gate re-reads `['household']` and moves us on; the screen never navigates itself. */
  onEnteredHousehold: () => void
  onScanCode: () => void
  onSignedOut: () => void
}

export function ThresholdScreen({
  userName,
  prefillCode,
  onEnteredHousehold,
  onScanCode,
  onSignedOut,
}: ThresholdScreenProps) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const [hint, showHint] = useHint()
  const [householdName, setHouseholdName] = useState('')
  const [code, setCode] = useState(() => normalizeInviteCode(prefillCode ?? ''))
  const create = useCreateHouseholdMutation()
  const join = useJoinHouseholdMutation()
  const signOut = useSignOutMutation()

  /**
   * A code can also arrive *before* the account did: someone taps an invite
   * link on a phone with nobody signed in, gets sent through sign-up, and the
   * code waits in storage across that whole detour. Picked up once, on mount,
   * and only when the route did not already carry one.
   */
  useEffect(() => {
    if (prefillCode) return
    let mounted = true
    takeInviteCode().then((stored) => {
      if (mounted && stored) setCode(stored)
    })
    return () => {
      mounted = false
    }
  }, [prefillCode])

  const canCreate = householdName.trim().length > 0
  const canJoin = isCompleteInviteCode(code)

  /**
   * Both mutations end the same way, and the ending is the same as the gate's
   * question: is there a household now? Seeding the answer rather than only
   * invalidating it means the redirect happens on the value we were just
   * handed, with no second round trip between the success and the dashboard.
   */
  async function settle(household: Household) {
    queryClient.setQueryData(['household'], household)
    queryClient.invalidateQueries({ queryKey: ['household'] })
    // Awaited, not fired and forgotten: the dashboard reads this flag the
    // moment it mounts, and a write still in flight is a tour that never runs.
    await armFirstRunTour()
    onEnteredHousehold()
  }

  /**
   * `already_in_household` is not an error the user can act on — it means a
   * foyer appeared while this screen was open (another device, a second tab,
   * an invite accepted elsewhere). Re-reading is the whole recovery, and the
   * gate takes it from there.
   */
  function isRaceNotFailure(error: ApiError) {
    if (!error) return false
    return error.type === 'already_in_household'
  }

  async function handleCreate() {
    const result = await create.mutateAsync(householdName.trim())
    if (result.ok) {
      await settle(result.value)
      return
    }
    if (isRaceNotFailure(result.error)) {
      queryClient.invalidateQueries({ queryKey: ['household'] })
      onEnteredHousehold()
    }
  }

  async function handleJoin() {
    const result = await join.mutateAsync(code)
    if (result.ok) {
      await settle(result.value)
      return
    }
    if (isRaceNotFailure(result.error)) {
      queryClient.invalidateQueries({ queryKey: ['household'] })
      onEnteredHousehold()
    }
  }

  async function handlePaste() {
    // `parseInviteCode`, not `normalizeInviteCode`: what people copy is the
    // whole share message, and normalizing that returns its first eight
    // letters — `REJOINSN` for a message beginning "Rejoins-nous".
    const clip = await Clipboard.getStringAsync().catch(() => '')
    const parsed = parseInviteCode(clip ?? '')
    if (!parsed) {
      showHint('Pas de code dans le presse-papier.')
      return
    }
    setCode(parsed)
  }

  async function handleSignOut() {
    await signOut.mutateAsync(undefined)
    queryClient.clear()
    onSignedOut()
  }

  const createError = errorMessage(create.error, create.data, "On n’a pas pu créer le foyer.")
  const joinError = errorMessage(join.error, join.data, 'On n’a pas pu rejoindre ce foyer.')
  // The invalid-code case belongs on the field, not only in a sentence under
  // it: the eight cells are what the user has to change.
  const codeRejected = join.data && !join.data.ok && join.data.error.type === 'invalid_invite_code'

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <AuthBlobBackground />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack width="100%" maxWidth={440} gap="$5">
              <XStack alignItems="center" gap="$2" alignSelf="center">
                <Image
                  source={require('../../../assets/illustrations/carrot-3d.png')}
                  style={{ width: 36, height: 36 }}
                  resizeMode="contain"
                  accessibilityLabel=""
                />
                <Text fontSize={16} fontWeight="800" letterSpacing={1} color={palette.ink}>
                  FRIDGE AI
                </Text>
              </XStack>

              <YStack gap="$2">
                <Text fontSize={24} fontWeight="800" color={palette.ink} lineHeight={30}>
                  {userName ? `Bienvenue, ${userName}.` : 'Bienvenue.'}
                </Text>
                <Text fontSize={14} fontWeight="500" color={palette.inkSecondary}>
                  Fridge AI tient un seul garde-manger, partagé par tout le monde qui vit ici. Commence par
                  dire lequel est le tien.
                </Text>
              </YStack>

              {/* Branch one: the screen's sole dark surface. */}
              <YStack
                testID="threshold-create-card"
                backgroundColor={palette.brandDeep}
                overflow="hidden"
                style={{
                  borderTopLeftRadius: 36,
                  borderTopRightRadius: 20,
                  borderBottomRightRadius: 36,
                  borderBottomLeftRadius: 20,
                  position: 'relative',
                  shadowColor: palette.shadowCool,
                  shadowOffset: { width: 0, height: 16 },
                  shadowOpacity: 0.22,
                  shadowRadius: 28,
                  elevation: 6,
                }}
              >
                <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
                <YStack padding="$5" gap="$3">
                  <Text fontSize={20} fontWeight="800" color={palette.brandDeepText}>
                    Je démarre le foyer
                  </Text>
                  <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
                    Tu repartiras avec un code à huit caractères à donner aux autres.
                  </Text>
                  <AuthField
                    label="Nom du foyer"
                    // Tinted from the card it sits on, never the system's flat
                    // gray — the same rule the pastel cards follow.
                    labelColor={palette.brandDeepTextSecondary}
                    placeholder="Maison Bellevue"
                    value={householdName}
                    onChangeText={setHouseholdName}
                    maxLength={80}
                    testID="threshold-household-name"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (canCreate) handleCreate()
                    }}
                  />
                  {createError ? <AuthError message={createError} /> : null}
                  <AuthButton
                    testID="threshold-create-submit"
                    label="Créer le foyer"
                    pendingLabel="Création..."
                    pending={create.isPending}
                    disabled={!canCreate}
                    onPress={handleCreate}
                  />
                </YStack>
              </YStack>

              {/* Branch two: lighter surface, same weight of action. */}
              <YStack
                testID="threshold-join-card"
                backgroundColor={palette.cream}
                padding="$5"
                gap="$3"
                style={{
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 32,
                  borderBottomRightRadius: 20,
                  borderBottomLeftRadius: 32,
                  shadowColor: palette.shadowCool,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.1,
                  shadowRadius: 18,
                  elevation: 2,
                }}
              >
                <Text fontSize={20} fontWeight="800" color={palette.ink}>
                  On m’a donné un code
                </Text>
                <Text fontSize={13} fontWeight="500" color={palette.creamText}>
                  Huit lettres ou chiffres, depuis l’écran Foyer de la personne qui t’invite.
                </Text>

                <InviteCodeField
                  value={code}
                  onChangeText={setCode}
                  onSubmit={() => canJoin && handleJoin()}
                  invalid={Boolean(codeRejected)}
                  testID="threshold-invite-code"
                />

                <XStack gap="$3" flexWrap="wrap">
                  <PillButton
                    testID="threshold-paste"
                    label="Coller"
                    tone="quiet"
                    icon={(color) => <ClipboardIcon size={15} color={color} />}
                    onPress={handlePaste}
                    accessibilityLabel="Coller le code depuis le presse-papier"
                    palette={palette}
                  />
                  <PillButton
                    testID="threshold-scan"
                    label="Scanner un QR"
                    tone="quiet"
                    icon={(color) => <QrCodeIcon size={15} color={color} />}
                    onPress={onScanCode}
                    accessibilityLabel="Scanner le QR code d’invitation"
                    palette={palette}
                  />
                </XStack>

                {joinError ? <AuthError message={joinError} /> : null}
                <AuthButton
                  testID="threshold-join-submit"
                  label="Rejoindre le foyer"
                  pendingLabel="On te fait entrer..."
                  pending={join.isPending}
                  disabled={!canJoin}
                  onPress={handleJoin}
                />
              </YStack>

              <YStack alignItems="center">
                <PillButton
                  testID="threshold-sign-out"
                  label="Changer de compte"
                  tone="quiet"
                  onPress={handleSignOut}
                  palette={palette}
                />
              </YStack>
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <HintBubble hint={hint} palette={palette} />
    </YStack>
  )
}

/**
 * A mutation here can fail two ways — the request threw (offline), or the
 * server answered with a domain error — and a screen that only reads one of
 * them goes silent on the other. `already_in_household` is filtered out on
 * purpose: it is handled as a race above, so printing it would name a problem
 * that has already resolved itself.
 */
function errorMessage(
  thrown: unknown,
  data: Result<Household, ApiError> | undefined,
  fallback: string,
): string | null {
  if (thrown) return `${fallback} Vérifie ta connexion.`
  if (data && !data.ok && data.error && data.error.type !== 'already_in_household') return data.error.message
  return null
}
