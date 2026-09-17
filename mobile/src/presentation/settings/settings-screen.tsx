import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { Chip } from '../shared/chip.js'
import { ActionSheet, type ActionSheetOption } from '../shared/action-sheet.js'
import { PillButton } from '../shared/pill-button.js'
import { useHint } from '../shared/hint-bubble.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { showToast } from '../../application/shared/toast.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import {
  CircleCheckIcon,
  HomeIcon,
  LogOutIcon,
  RefreshIcon,
  ServerIcon,
  SettingsIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from '../dashboard/dashboard-icons.js'
import { resetWelcomeSeen } from '../welcome/use-welcome-seen.js'
import { IdentityCard, RoleBadge } from './identity-card.js'
import { initials } from '../shared/member-avatars.js'
import { AuthButton } from '../identity/auth-button.js'
import { ROLE_LABELS } from '../identity/role-labels.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import { useInstanceInfoQuery } from '../../application/instance/instance-info.query.js'
import { clearServerUrl, getServerUrl } from '../../infrastructure/http/server-config.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }

// A pushed screen (reached from the dashboard's "Réglages" link), not one
// of the four tabs — so `AppShell`'s `{ kind: 'stack' }` nav: no bottom
// tab nav, a BackButton in the header instead (same convention recipe/
// shopping-list already used), still the full BlobBackground + tablet/
// desktop Sidebar shell everywhere else gets. An audit found this screen
// had none of that — no shell at all, not even a way back on mobile
// except the OS gesture.
//
// Redesigned (2026-08-30) to feel as crafted as the dashboard: the same
// pastel StatCard language for account/household identity, the same chip
// pattern as the fridge's location filters for the provider picker, and
// sign-out as a real secondary `AuthButton` — moved here from the
// dashboard header's small text link, its one home now.
//
// Narrowed to configuration (2026-09-06): the receipt history left for the
// dashboard (`ReceiptsRow`) — a list of what the foyer bought is content, and
// filing it under a "Données" heading in the screen you open to change how the
// app behaves is where it went to be forgotten. What is left here changes
// behaviour: who you are, which foyer, which AI, and the way out.
//
// The identity pair was widened (2026-09-05): the two half-width StatCards
// truncated the household name to "Le foyer de F…" on every phone, which is
// the one string on this screen that has to be readable. They are now two
// stacked full-width `IdentityCard`s, and the foyer's card stopped being a
// name with the word "gérer" after it — it shows who is in the foyer
// (member avatars) and what you are in it (role badge), so the tap has
// something to promise.
export function SettingsScreen() {
  const palette = useSoftPalette()
  const session = useSessionQuery()
  const household = useHouseholdQuery()
  const signOut = useSignOutMutation()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()
  const instance = useInstanceInfoQuery()
  const queryClient = useQueryClient()
  const [providerError, setProviderError] = useState<string | null>(null)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [debugMenuOpen, setDebugMenuOpen] = useState(false)
  const [hint, showHint] = useHint()
  const refresh = usePullToRefresh(
    () => session.refetch(),
    () => household.refetch(),
    () => settings.refetch(),
    () => instance.refetch(),
  )

  async function handleSelectProvider(provider: AiProvider) {
    if (settings.data?.activeProvider === provider) {
      return
    }
    setProviderError(null)
    const result = await setProvider.mutateAsync(provider)
    if (!result.ok) {
      setProviderError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
  }

  // Clears every device-local first-run flag and previews the result
  // immediately rather than asking whoever is testing it to force-quit and
  // relaunch — the whole point of a dev tool is not costing more than the
  // thing it's checking. Also signs out: `/welcome` finishes onto
  // `/(auth)/sign-up`, and `(auth)/_layout.tsx` redirects straight to the
  // tabs whenever a session exists — previewing the onboarding flow while
  // still signed in bounced off that gate before this reached `/welcome` at
  // all. Best-effort: a sign-out failure here shouldn't block the one thing
  // this button is for.
  //
  // Clears the chosen server too, not just the welcome flag — a reset that
  // still landed on `/server-choice` pre-picked with the last real server
  // wasn't previewing first launch, it was previewing "second launch".
  async function handleResetAppState() {
    setDebugMenuOpen(false)
    try {
      await signOut.mutateAsync(undefined)
      await session.refetch()
    } catch {
      // Preview it anyway — see comment above.
    }
    await resetWelcomeSeen()
    await clearServerUrl()
    router.replace('/welcome')
  }

  async function handleSignOut() {
    setConfirmingSignOut(false)
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const signOutError = signOut.error ? 'Une erreur est survenue lors de la déconnexion.' : null
  const members = household.data?.members ?? []
  const memberSummary = members.length > 0 ? `${members.length} membre${members.length > 1 ? 's' : ''}` : undefined
  const roleLabel = household.data ? ROLE_LABELS[household.data.role] : null
  const householdSpokenLabel = [
    'Foyer',
    household.isPending ? 'chargement' : household.isError ? 'indisponible' : (household.data?.name ?? 'aucun foyer'),
    memberSummary,
    roleLabel ? `tu es ${roleLabel.toLowerCase()}` : null,
    'gérer le foyer',
  ]
    .filter(Boolean)
    .join('. ')
  const availableProviders = settings.data?.availableProviders ?? []
  // The gate is `availableProviders`, never `source`. `source` only records
  // whether anyone has picked yet (`env-ai-settings-provider.ts`: a stored row
  // wins, env is the first-boot fallback), so reading it as "the administrator
  // configured this" described a lock that does not exist — the foyer can
  // change the provider whenever more than one has credentials.
  const canChooseProvider = availableProviders.length > 1

  // Every row closes the sheet on its own press — a debug action fires once
  // and gets out of the way, the same recipe `ActionSheet`'s real callers use.
  const debugOptions: ActionSheetOption[] = [
    {
      testID: 'debug-toast-network-error',
      label: 'Toast réseau',
      icon: (color) => <TriangleAlertIcon size={16} color={color} />,
      tint: palette.chipOrange,
      onPress: () => {
        setDebugMenuOpen(false)
        showToast('Impossible de contacter le serveur. (debug)')
      },
    },
    {
      testID: 'debug-toast-info',
      label: 'Toast info',
      icon: (color) => <CircleCheckIcon size={16} color={color} />,
      tint: palette.chipTeal,
      onPress: () => {
        setDebugMenuOpen(false)
        showToast('Reconnecté au serveur. (debug)', 'info')
      },
    },
    {
      testID: 'debug-hint-success',
      label: 'Hint succès',
      icon: (color) => <CircleCheckIcon size={16} color={color} />,
      tint: palette.fresh,
      onPress: () => {
        setDebugMenuOpen(false)
        showHint('Ajouté au frigo. (debug)', 'success')
      },
    },
    {
      testID: 'debug-hint-error',
      label: 'Hint erreur',
      icon: (color) => <TriangleAlertIcon size={16} color={color} />,
      tint: palette.expired,
      onPress: () => {
        setDebugMenuOpen(false)
        showHint('Une erreur est survenue. (debug)', 'error')
      },
    },
    {
      testID: 'debug-hint-neutral',
      label: 'Hint neutre',
      icon: (color) => <SparklesIcon size={16} color={color} />,
      tint: palette.chipViolet,
      onPress: () => {
        setDebugMenuOpen(false)
        showHint('Bientôt disponible. (debug)')
      },
    },
    {
      // Not `destructive`: it touches no household data, only local device
      // flags — the red treatment is reserved for a row that can hurt the
      // foyer's shared state, which this can't.
      testID: 'debug-reset-app-state',
      label: 'Réinitialiser l’état de l’app',
      icon: (color) => <RefreshIcon size={16} color={color} />,
      tint: palette.navCardViolet,
      onPress: () => {
        void handleResetAppState()
      },
    },
  ]

  return (
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <SettingsIcon size={19} color={color} />}
          title="Réglages"
          onBack={() => router.back()}
        />
      }
    >
      <YStack gap="$3" marginTop="$5">
        <IdentityCard
          testID="settings-account"
          bg={palette.cream}
          labelColor={palette.creamText}
          chipColor={palette.chipOrange}
          icon={
            <Text fontSize={14} fontWeight="800" color={palette.onDark}>
              {initials(session.data?.user.name || '?')}
            </Text>
          }
          label="Compte"
          value={session.data?.user.name || '—'}
          secondary={session.data?.user.email}
          corner="a"
          palette={palette}
          onPress={() => router.push('/account')}
        />
        <IdentityCard
          testID="settings-household"
          bg={palette.mintPale}
          labelColor={palette.mintPaleText}
          chipColor={palette.chipTeal}
          icon={<HomeIcon size={18} color={palette.onDark} />}
          label="Foyer"
          // Three distinct states, three distinct sentences. A failed read used
          // to render "Aucun foyer" — a fact about the account, printed for a
          // fact about the network, which invents a state the user does not
          // have and cannot act on.
          value={household.isPending ? '—' : household.isError ? 'Foyer indisponible' : (household.data?.name ?? 'Aucun foyer')}
          secondary={
            household.isError ? 'Tire pour réessayer.' : (memberSummary ?? 'Personne d’autre pour l’instant')
          }
          trailing={roleLabel ? <RoleBadge label={roleLabel} palette={palette} /> : null}
          corner="b"
          palette={palette}
          onPress={() => router.push('/household')}
          // The card is a Pressable, so RN collapses its children into this
          // one label: "Gérer le foyer" alone swallowed the foyer's name, its
          // member count, the role badge and the avatars — everything the card
          // was redesigned to show.
          accessibilityLabel={householdSpokenLabel}
        />
      </YStack>

      <YStack marginTop="$3" gap="$2">
        {/* Same card language as the Foyer button above (2026-09-09 ask): a
            static `IdentityCard` — no `onPress`, same as the Compte card —
            rather than a bare label + chips floating on the page background. */}
        <IdentityCard
          testID="settings-ai-provider"
          bg={palette.lavender}
          labelColor={palette.lavenderText}
          chipColor={palette.chipViolet}
          icon={<SparklesIcon size={18} color={palette.onDark} />}
          label="Intelligence artificielle"
          // What the section governs, before what it offers. Named
          // "Fournisseur IA", it asked the foyer to pick between three
          // vendors without ever saying what the pick changes.
          value={settings.data?.activeProvider ? PROVIDER_LABELS[settings.data.activeProvider] : '—'}
          secondary="Lit tes tickets de caisse et invente tes recettes."
          corner="a"
          palette={palette}
          footer={
            <YStack gap="$2">
              {canChooseProvider ? (
                <XStack gap="$3" flexWrap="wrap">
                  {availableProviders.map((provider) => (
                    <Chip
                      key={provider}
                      testID={`ai-provider-${provider}`}
                      label={PROVIDER_LABELS[provider]}
                      selected={settings.data?.activeProvider === provider}
                      onPress={() => handleSelectProvider(provider)}
                      palette={palette}
                    />
                  ))}
                </XStack>
              ) : null}
              {setProvider.isPending ? (
                // The mutation had no visible state at all: on a slow connection a
                // tap on "Ollama" produced nothing until the invalidation landed.
                <Text fontSize={12} fontWeight="600" color={palette.lavenderText} accessibilityLiveRegion="polite">
                  Changement en cours…
                </Text>
              ) : null}
              {settings.data && availableProviders.length === 0 ? (
                // `activeProvider` can name a provider whose key is gone — the picker
                // then drew an empty row and no selection, explaining nothing.
                <Text fontSize={13} color={palette.expiredText}>
                  Aucun fournisseur n’est configuré sur ce serveur.
                </Text>
              ) : null}
              {!settings.isPending && !settings.data ? (
                <Text fontSize={13} color={palette.expiredText}>
                  Impossible de charger les réglages.
                </Text>
              ) : null}
              {providerError ? (
                <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
                  {providerError}
                </Text>
              ) : null}
              {settings.data?.models.vision ? (
                <Text testID="settings-ai-models" fontSize={12} fontWeight="600" color={palette.lavenderText}>
                  Vision : {settings.data.models.vision} · Texte : {settings.data.models.text}
                </Text>
              ) : null}
            </YStack>
          }
        />
      </YStack>

      <YStack marginTop="$3" gap="$2">
        <IdentityCard
          testID="settings-instance"
          bg={palette.cream}
          labelColor={palette.creamText}
          chipColor={palette.chipOrange}
          icon={<ServerIcon size={17} color={palette.onDark} />}
          label="Serveur"
          value={
            instance.data
              ? instance.data.name ?? (instance.data.mode === 'hosted' ? 'Garde-manger hébergé' : 'Garde-manger auto-hébergé')
              : '—'
          }
          secondary={instance.data ? `${getServerUrl()} · v${instance.data.version}` : 'Impossible de contacter ce serveur.'}
          corner="b"
          palette={palette}
          onPress={() => router.push('/server-info')}
        />
      </YStack>

      {/* Dev-only: one menu instead of a growing row of pills — the row was
          already wrapping to two lines at five buttons, and "Réinitialiser
          l'onboarding" made it six. Never bundled into a release build. */}
      {__DEV__ ? (
        <YStack marginTop="$8" gap="$2">
          <Text fontSize={13} fontWeight="800" color={palette.ink}>
            Debug (dev only)
          </Text>
          <PillButton
            testID="debug-menu-open"
            label="Outils de debug"
            tone="quiet"
            size="dense"
            palette={palette}
            icon={(color) => <SettingsIcon size={14} color={color} />}
            onPress={() => setDebugMenuOpen(true)}
          />
          <ActionSheet
            visible={debugMenuOpen}
            onClose={() => setDebugMenuOpen(false)}
            title="Outils de debug"
            description="Jamais en build de production."
            options={debugOptions}
          />
        </YStack>
      ) : null}

      {/* One consistent $8 rhythm between every section on the page (Serveur
          above, this, the version line below) — the version line used to sit
          between Serveur and Debug at its own $5, which broke that rhythm and
          read as a stray fact dropped mid-list rather than the page's close. */}
      <YStack marginTop="$8" gap="$2">
        <AuthButton
          testID="sign-out"
          label="Se déconnecter"
          pendingLabel="Déconnexion..."
          pending={signOut.isPending}
          variant="secondary"
          icon={<LogOutIcon size={16} color={palette.ink} />}
          // Confirmed like every other consequential action in the app. It was
          // the one exception, and the scene it fails in is a shared kitchen
          // tablet: a mis-tap signs the whole foyer's device out.
          onPress={() => setConfirmingSignOut(true)}
        />
        {signOutError ? (
          <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
            {signOutError}
          </Text>
        ) : null}
      </YStack>

      <YStack marginTop="$8" alignItems="center">
        <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
          Garde-manger · v{Constants.expoConfig?.version ?? '—'}
        </Text>
      </YStack>

      <ActionSheet
        visible={confirmingSignOut}
        title="Se déconnecter ?"
        description="Il faudra se reconnecter pour retrouver le garde-manger du foyer sur cet appareil."
        options={[
          {
            testID: 'sign-out-confirm',
            label: 'Se déconnecter',
            icon: (color) => <LogOutIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: handleSignOut,
          },
        ]}
        onClose={() => setConfirmingSignOut(false)}
      />
    </AppShell>
  )
}
