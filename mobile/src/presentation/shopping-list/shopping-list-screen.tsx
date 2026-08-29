/*
 * DIRECTION CONTRACT — shopping list screen (2026-08-28; a legal-pad
 * notepad, committed to rather than hinted at, per a second round of
 * feedback that explicitly asked for the yellow paper + spiral binding +
 * hand-drawn check this file's first version had deliberately avoided —
 * "if you're going to do it, do it," with the one guardrail being craft:
 * commit to the material, not to a costume version of it)
 *
 * First real "next page" past the Frigo dashboard, built once DESIGN.md
 * existed to build against instead of inventing tokens per screen. Same
 * world, same shell (mint blob ground on mobile, sidebar+frame on
 * tablet/desktop) — but the list card itself is a deliberate, disclosed
 * exception to system rules, scoped to this one screen only:
 *
 * — "No borders anywhere" (DESIGN.md Shapes) → a thin dashed rule between
 *   rows (a tear-line between list entries).
 * — Corner language is asymmetric-but-rounded everywhere else → this
 *   card's top edge is nearly square (a spiral runs along a flat edge in
 *   real life, never a rounded one); only the bottom corners round, and
 *   asymmetrically between them, so the "no uniform radius" rule still
 *   holds inside the exception.
 * — "Icons are drawn... in one consistent stroke and weight" (craft
 *   floor) still holds, but the checkmark and strikethrough in this list
 *   specifically are drawn as one imperfect, hand-felt pen stroke
 *   (`HandDrawnCheck`, the wavy strike inside `ShoppingRow`) instead of
 *   the app's usual precise lucide-style icon geometry — the one place
 *   in the system where "hand-drawn" is the honest material, not a slip.
 * — Every Pressable elsewhere spring-bounces on hover/press
 *   (`useHoverPress`) → `ShoppingRow` deliberately does NOT: a list of
 *   many rows all bouncing on hover read as gimmicky on the web (the
 *   complaint that started this file's first revision), so rows get a
 *   quiet, instant background tint on hover and a brief opacity dip on
 *   press instead — felt, not performed. That guardrail didn't change
 *   between rounds; only the paper commitment did.
 *
 * "Modern, not kitsch": the yellow is a muted legal-pad tone, not
 * highlighter/neon; the spiral is a strip of flat holes + a thin metal
 * ring, not an illustrated coil; the hand-drawn stroke is one confident
 * curve, not a jittery scribble. Three real material cues, executed with
 * restraint, not a pile of decorative textures.
 *
 * SCOPE, disclosed like every other placeholder in this codebase: this
 * is read + toggle-checked only. Adding a new item, editing quantity, and
 * deleting are real backend endpoints (`POST`/`DELETE /api/shopping-
 * items`) not wired here yet — the FAB shows the same honest "bientôt
 * disponible" hint as the rest of the app rather than a dead control.
 */
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { Sidebar } from '../shared/sidebar.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { BlobBackground } from '../shared/blob-background.js'
import { BackButton } from '../shared/back-button.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ShoppingCartIcon } from '../dashboard/dashboard-icons.js'
import { SpiralBinding } from './spiral-binding.js'
import { ShoppingRow } from './shopping-row.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useUpdateShoppingItemMutation } from '../../application/shopping-list/update-shopping-item.mutation.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

const TABLET_BREAKPOINT = 768

function ShoppingListContent() {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const queryClient = useQueryClient()
  const itemsQuery = useShoppingItemsQuery()
  // Invalidate explicitly on success — this "just worked" against the fake
  // connector without it (it mutates its fixture array in place, so the
  // cached reference happened to reflect the change on any re-render), but
  // that's a fake-connector accident, not real reactivity: the http
  // connector returns a fresh object from a fresh fetch, and without this
  // the list would silently show stale `checked` state against a real
  // backend. Caught by noticing the fake connector's own mutation style,
  // not by anything failing visibly in this session.
  const updateItem = useUpdateShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })

  const items = itemsQuery.data ?? []
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  function handleToggle(item: ShoppingItem, next: boolean) {
    updateItem.mutate({ itemId: item.id, patch: { checked: next } })
  }

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={isWide ? [] : ['top', 'bottom']}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 40,
            paddingTop: isWide ? 32 : 20,
            maxWidth: isWide ? 640 : undefined,
            width: isWide ? '100%' : undefined,
            alignSelf: isWide ? 'center' : undefined,
          }}
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <XStack alignItems="center" gap="$3">
              {isWide ? null : <BackButton onPress={() => router.back()} ink={palette.ink} cream={palette.cream} />}
              <YStack>
                <Text fontSize={20} fontWeight="800" color={palette.ink}>
                  Liste de courses
                </Text>
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                  {itemsQuery.isPending
                    ? 'Chargement...'
                    : `${unchecked.length} article${unchecked.length > 1 ? 's' : ''} restant${unchecked.length > 1 ? 's' : ''}`}
                </Text>
              </YStack>
            </XStack>
            <Pressable
              testID="shopping-list-add"
              onPress={() => router.push('/(tabs)/shopping-list/new')}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un article"
              style={pointerCursor}
            >
              <XStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
                <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                  + Ajouter
                </Text>
              </XStack>
            </Pressable>
          </XStack>

          {itemsQuery.isError ? (
            <XStack backgroundColor={palette.expiredBg} borderRadius={14} padding="$3" marginTop="$4">
              <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
                Impossible de charger la liste de courses.
              </Text>
            </XStack>
          ) : null}

          {!itemsQuery.isPending && items.length === 0 ? (
            <YStack alignItems="center" gap="$2" marginTop="$8">
              <ShoppingCartIcon size={32} color={palette.inkSecondary} />
              <Text fontSize={14} fontWeight="600" color={palette.inkSecondary}>
                Liste de courses vide
              </Text>
            </YStack>
          ) : null}

          {unchecked.length > 0 ? (
            <YStack
              marginTop="$5"
              backgroundColor={palette.paperCard}
              overflow="hidden"
              style={{
                // Nearly-square top (a coil runs along a flat edge),
                // asymmetric rounded bottom — the "no uniform radius"
                // rule holds inside the notepad exception, just shaped
                // like a real pad instead of the app's usual soft corners.
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                borderBottomRightRadius: 20,
                borderBottomLeftRadius: 10,
                shadowColor: palette.shadowCool,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 1,
              }}
            >
              <SpiralBinding palette={palette} />
              <YStack paddingHorizontal="$2">
                {unchecked.map((item, index) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    isLast={index === unchecked.length - 1}
                    onToggle={(next) => handleToggle(item, next)}
                  />
                ))}
              </YStack>
            </YStack>
          ) : null}

          {checked.length > 0 ? (
            <YStack marginTop="$6">
              <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>
                Déjà pris ({checked.length})
              </Text>
              <YStack
                marginTop="$3"
                backgroundColor={palette.paperCard}
                paddingHorizontal="$2"
                style={{
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 16,
                  borderBottomRightRadius: 8,
                  borderBottomLeftRadius: 16,
                  // A slight tilt — no spiral strip here on purpose: this
                  // is the torn-off page set aside, not another notepad.
                  transform: [{ rotate: '-1deg' }],
                  shadowColor: palette.shadowCool,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 1,
                }}
              >
                {checked.map((item, index) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    isLast={index === checked.length - 1}
                    onToggle={(next) => handleToggle(item, next)}
                  />
                ))}
              </YStack>
            </YStack>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  )
}

export function ShoppingListScreen() {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const [streakDays] = useState(12) // same synthetic streak as the dashboard fixture — see dashboard.fixture.ts's disclosed gap
  const [hint, showHint] = useHint()

  if (!isWide) return <ShoppingListContent />

  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: palette.layoutSurface }} edges={['top', 'bottom']}>
      <XStack flex={1} minHeight={0} backgroundColor={palette.layoutSurface}>
        <Sidebar
          palette={palette}
          streakDays={streakDays}
          active="courses"
          onOpenFrigo={() => router.push('/(tabs)')}
          onOpenRecettes={() => router.push('/(tabs)/recipes')}
          onOpenCourses={() => {}}
          onScan={() => showHint('Scanner — bientôt disponible')}
        />
        <YStack flex={1} minHeight={0} padding="$4" style={{ position: 'relative' }}>
          <YStack
            flex={1}
            minHeight={0}
            overflow="hidden"
            style={{
              borderRadius: 28,
              shadowColor: palette.shadowWarm,
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.2,
              shadowRadius: 26,
              elevation: 4,
            }}
          >
            <ShoppingListContent />
          </YStack>
          <HintBubble hint={hint} palette={palette} />
        </YStack>
      </XStack>
    </SafeAreaView>
  )
}
