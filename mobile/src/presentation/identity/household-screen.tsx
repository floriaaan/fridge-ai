/*
 * The foyer, finally visible.
 *
 * PRODUCT.md's first principle is "le foyer est l'unité de vérité, jamais
 * l'utilisateur seul", and it is the differentiator named as structuring
 * against the single-user shopping-list apps. The UI had no surface for it
 * at all: no member list, no invite, no attribution, and a household name
 * hardcoded to a fixture — every deployment showed every user the same
 * "Foyer Leroux". The backend has shipped /api/households since phase 1.
 *
 * The invite code is the whole onboarding path for the second member, so it
 * is the loudest thing on the screen for an owner and simply absent for a
 * member (the API omits it for anyone but the owner, which is what the UI
 * gates on — never on the role string alone).
 */
import { useState } from 'react'
import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { usePullToRefresh } from '../shared/pull-to-refresh.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { PillButton } from '../shared/pill-button.js'
import { pointerCursor } from '../shared/hover.js'
import { AuthButton } from './auth-button.js'
import { InviteShareCard } from './invite-share-card.js'
import { ROLE_LABELS } from './role-labels.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { HomeIcon, LogOutIcon, UserIcon, UsersIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { IdentityCard } from '../settings/identity-card.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useRegenerateInviteCodeMutation } from '../../application/identity/regenerate-invite-code.mutation.js'
import { useRemoveHouseholdMemberMutation } from '../../application/identity/remove-household-member.mutation.js'
import { useLeaveHouseholdMutation } from '../../application/identity/leave-household.mutation.js'
import { useHaLinkQuery } from '../../application/home-assistant/ha-link.query.js'
import type { HouseholdMember } from '../../domain/identity/household.js'

export function HouseholdScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const household = useHouseholdQuery()
  const session = useSessionQuery()
  const regenerate = useRegenerateInviteCodeMutation()
  const removeMember = useRemoveHouseholdMemberMutation()
  const leave = useLeaveHouseholdMutation()
  const haLink = useHaLinkQuery()
  const [hint, showHint] = useHint()
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const data = household.data
  const isOwner = data?.role === 'owner'
  const currentUserId = session.data?.user.id

  async function handleRegenerate() {
    const result = await regenerate.mutateAsync(undefined)
    if (!result.ok) {
      showHint(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint('Nouveau code généré. L’ancien ne marche plus.')
  }

  async function handleRemove(member: HouseholdMember) {
    setMemberToRemove(null)
    const result = await removeMember.mutateAsync(member.userId)
    if (!result.ok) {
      showHint(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['household'] })
    showHint(`${member.name} ne fait plus partie du foyer.`)
  }

  async function handleLeave() {
    setConfirmLeave(false)
    const result = await leave.mutateAsync(undefined)
    if (!result.ok) {
      showHint(result.error.message)
      return
    }
    // Not sign-in. Leaving a foyer is not leaving the account — the session
    // is untouched, and the account is now exactly what a brand-new one is:
    // signed in, with no foyer. That is the onboarding's state, and the
    // `(tabs)` gate would bounce us there anyway; going straight avoids a
    // frame of dashboard belonging to a household that no longer exists.
    queryClient.clear()
    router.replace('/(onboarding)')
  }

  const refresh = usePullToRefresh(() => household.refetch())

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <UsersIcon size={19} color={color} />}
      title="Foyer"
      subtitle={data ? `${data.members.length} membre${data.members.length > 1 ? 's' : ''}` : undefined}
      onBack={() => goBack('/settings')}
    />
  )

  if (!data) {
    return (
      <AppShell nav={{ kind: 'stack' }} refresh={refresh} header={header}>
        <YStack marginTop="$5" gap="$3" alignItems="flex-start">
          {/* Three states, not two. "Tu n'appartiens à aucun foyer" is a fact
              about the account; printing it for a failed read tells someone
              their foyer is gone, and offers nothing to do about it. */}
          <Text
            fontSize={14}
            fontWeight="500"
            color={household.isError ? palette.expiredText : palette.inkSecondary}
          >
            {household.isPending
              ? 'Chargement du foyer…'
              : household.isError
                ? 'On n’a pas pu lire ton foyer. Vérifie ta connexion.'
                : 'Tu n’appartiens à aucun foyer.'}
          </Text>
          {household.isError ? (
            <PillButton
              testID="household-retry"
              label="Réessayer"
              accessibilityLabel="Réessayer de charger le foyer"
              onPress={() => household.refetch()}
              palette={palette}
            />
          ) : null}
        </YStack>
      </AppShell>
    )
  }

  return (
    <>
    <AppShell nav={{ kind: 'stack' }} hint={hint} refresh={refresh} header={header}>

      {/* The header's title is generic ("Foyer", same convention as every
          other screen) — the custom household name still needs to be shown
          somewhere, to every member, not just the owner viewing the invite
          card below. */}
      <Text testID="household-name" fontSize={13} fontWeight="600" color={palette.inkSecondary}>
        {data.name}
      </Text>

      {data.inviteCode ? (
        <InviteShareCard
          householdName={data.name}
          inviteCode={data.inviteCode}
          palette={palette}
          regenerating={regenerate.isPending}
          onRegenerate={handleRegenerate}
          onFeedback={showHint}
        />
      ) : null}

      <YStack marginTop="$6" gap="$2">
        <Text fontSize={15} fontWeight="800" color={palette.ink}>
          Membres
        </Text>
        {data.members.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            isSelf={member.userId === currentUserId}
            canRemove={isOwner && member.userId !== currentUserId}
            onRemove={() => setMemberToRemove(member)}
            palette={palette}
          />
        ))}
      </YStack>

      {isOwner ? (
        <YStack marginTop="$8" gap="$2">
          <Text fontSize={15} fontWeight="800" color={palette.ink}>
            Maison connectée
          </Text>
          {/* Same card style as the Foyer button on Réglages (2026-09-09 ask):
              an `IdentityCard`, not the bespoke mintPale row this used to be. */}
          <IdentityCard
            testID="ha-settings-row"
            bg={palette.mintPale}
            labelColor={palette.mintPaleText}
            chipColor={palette.chipTeal}
            icon={<HomeIcon size={18} color={palette.onDark} />}
            label="Home Assistant"
            value={haLink.data?.configured && haLink.data.todoEntityName ? haLink.data.todoEntityName : 'Non configuré'}
            secondary="Garde ta liste de courses en phase avec Home Assistant."
            corner="b"
            palette={palette}
            onPress={() => router.push('/home-assistant')}
            accessibilityLabel={`Home Assistant. ${
              haLink.data?.configured && haLink.data.todoEntityName ? haLink.data.todoEntityName : 'Non configuré'
            }`}
          />
        </YStack>
      ) : null}

      <YStack marginTop="$8">
        <AuthButton
          testID="household-leave"
          label="Quitter le foyer"
          variant="secondary"
          icon={<LogOutIcon size={16} color={palette.ink} />}
          onPress={() => setConfirmLeave(true)}
        />
      </YStack>
    </AppShell>

    <ActionSheet
      visible={memberToRemove !== null}
      onClose={() => setMemberToRemove(null)}
      title={memberToRemove ? `Retirer ${memberToRemove.name} ?` : undefined}
      description="Cette personne perd l’accès au garde-manger, aux courses et aux recettes du foyer."
      options={
        memberToRemove
          ? [
              {
                testID: 'household-remove-confirm',
                label: 'Retirer du foyer',
                icon: (color) => <XIcon size={18} color={color} />,
                tint: palette.expired,
                destructive: true,
                onPress: () => handleRemove(memberToRemove),
              },
            ]
          : []
      }
    />

    <ActionSheet
      visible={confirmLeave}
      onClose={() => setConfirmLeave(false)}
      title="Quitter le foyer ?"
      description={
        isOwner
          ? 'Tu en es propriétaire : partir supprime le foyer et tout son contenu — produits, tickets, courses, recettes — pour tous les membres.'
          : 'Tu perdras l’accès au garde-manger, aux courses et aux recettes du foyer.'
      }
      options={[
        {
          testID: 'household-leave-confirm',
          label: isOwner ? 'Supprimer le foyer' : 'Quitter le foyer',
          icon: (color) => <LogOutIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: handleLeave,
        },
      ]}
    />
    </>
  )
}

function MemberRow({
  member,
  isSelf,
  canRemove,
  onRemove,
  palette,
}: {
  member: HouseholdMember
  isSelf: boolean
  canRemove: boolean
  onRemove: () => void
  palette: SoftPalette
}) {
  return (
    <XStack
      testID={`household-member-${member.userId}`}
      alignItems="center"
      gap="$3"
      backgroundColor={palette.gradientBottom}
      borderRadius={16}
      padding="$3"
      minHeight={56}
      style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 }}
    >
      <YStack width={36} height={36} borderRadius={999} backgroundColor={palette.mintPale} alignItems="center" justifyContent="center">
        <UserIcon size={17} color={palette.mintPaleText} />
      </YStack>
      <YStack flex={1}>
        <Text fontSize={14} fontWeight="700" color={palette.ink}>
          {member.name}
          {isSelf ? ' (toi)' : ''}
        </Text>
        <Text fontSize={12} fontWeight="500" color={palette.inkSecondary}>
          {ROLE_LABELS[member.role]} depuis le {new Date(member.joinedAt).toLocaleDateString('fr-FR')}
        </Text>
      </YStack>
      {canRemove ? (
        <Pressable
          testID={`household-remove-${member.userId}`}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${member.name} du foyer`}
          style={pointerCursor}
        >
          <XStack alignItems="center" minHeight={44} paddingHorizontal="$3" borderRadius={999} backgroundColor={palette.expiredBg}>
            <Text fontSize={12} fontWeight="700" color={palette.expiredText}>
              Retirer
            </Text>
          </XStack>
        </Pressable>
      ) : null}
    </XStack>
  )
}
