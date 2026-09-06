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
import { ROLE_LABELS } from './role-labels.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { LogOutIcon, RefreshIcon, UserIcon, UsersIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useRegenerateInviteCodeMutation } from '../../application/identity/regenerate-invite-code.mutation.js'
import { useRemoveHouseholdMemberMutation } from '../../application/identity/remove-household-member.mutation.js'
import { useLeaveHouseholdMutation } from '../../application/identity/leave-household.mutation.js'
import type { HouseholdMember } from '../../domain/identity/household.js'

export function HouseholdScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const household = useHouseholdQuery()
  const session = useSessionQuery()
  const regenerate = useRegenerateInviteCodeMutation()
  const removeMember = useRemoveHouseholdMemberMutation()
  const leave = useLeaveHouseholdMutation()
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
    queryClient.clear()
    router.replace('/(auth)/sign-in')
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

      <YStack
        marginTop="$5"
        backgroundColor={palette.brandDeep}
        padding="$5"
        gap="$2"
        style={{
          borderTopLeftRadius: 36,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 36,
          borderBottomLeftRadius: 20,
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.22,
          shadowRadius: 28,
          elevation: 6,
        }}
      >
        <Text fontSize={12} fontWeight="600" color={palette.brandDeepTextSecondary}>
          VOTRE FOYER
        </Text>
        <Text testID="household-name" fontSize={24} fontWeight="800" color={palette.brandDeepText} lineHeight={30}>
          {data.name}
        </Text>
        <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
          {data.members.length} membre{data.members.length > 1 ? 's' : ''} · tu es {ROLE_LABELS[data.role].toLowerCase()}
        </Text>
      </YStack>

      {data.inviteCode ? (
        <YStack
          marginTop="$4"
          backgroundColor={palette.cream}
          padding="$4"
          gap="$2"
          style={{
            borderTopLeftRadius: 26,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 26,
            borderBottomLeftRadius: 14,
          }}
        >
          <Text fontSize={12} fontWeight="700" color={palette.creamText}>
            Code d’invitation
          </Text>
          <Text testID="household-invite-code" fontSize={26} fontWeight="800" color={palette.ink} letterSpacing={2}>
            {data.inviteCode}
          </Text>
          <Text fontSize={12} fontWeight="500" color={palette.creamText}>
            Donne ce code à quelqu’un du foyer : il le saisit à l’inscription et voit le même garde-manger.
          </Text>
          <YStack marginTop="$2">
            <AuthButton
              testID="household-regenerate"
              label="Générer un nouveau code"
              pendingLabel="Génération..."
              pending={regenerate.isPending}
              variant="secondary"
              icon={<RefreshIcon size={16} color={palette.ink} />}
              onPress={handleRegenerate}
            />
          </YStack>
        </YStack>
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
