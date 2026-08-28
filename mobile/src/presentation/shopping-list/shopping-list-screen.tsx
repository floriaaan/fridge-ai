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
import { Animated, Pressable, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { ScrollView } from 'tamagui'
import { Line, Path, Svg } from 'react-native-svg'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { Sidebar } from '../shared/sidebar.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { BlobBackground } from '../dashboard/household-dashboard.js'
import { useSoftPalette, type SoftPalette } from '../dashboard/soft-palette.js'
import { ShoppingCartIcon } from '../dashboard/dashboard-icons.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useToggleShoppingItemMutation } from '../../application/shopping-list/toggle-shopping-item.mutation.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

const TABLET_BREAKPOINT = 768

function BackButton({ onPress, ink, cream }: { onPress: () => void; ink: string; cream: string }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fontSize={18} fontWeight="800" color={ink}>
          ←
        </Text>
      </Animated.View>
    </Pressable>
  )
}

/**
 * A tear-line between rows — an SVG dash, not `borderBottomWidth` +
 * `borderStyle:'dashed'`. That combination rendered a full dashed
 * rectangle around each row on web instead of a single bottom edge (RN
 * Web applies `borderStyle` to every side regardless of which side has a
 * width) — an actual bug the border-only version shipped with. SVG's
 * `strokeDasharray` draws exactly the one line asked for, everywhere.
 */
function RowDivider({ color }: { color: string }) {
  return (
    <Svg width="100%" height={1}>
      <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={color} strokeWidth={1} strokeDasharray="4,4" />
    </Svg>
  )
}

/** A flat strip of punched holes + a thin ring each — the pad's spiral edge. Flat top corners, not rounded: a coil runs along a straight edge. */
function SpiralBinding({ palette }: { palette: SoftPalette }) {
  const holes = Array.from({ length: 10 })
  return (
    <XStack
      justifyContent="space-around"
      alignItems="center"
      paddingVertical="$1.5"
      backgroundColor={palette.paperBindingStrip}
      style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
    >
      {holes.map((_, i) => (
        <YStack
          key={i}
          width={9}
          height={9}
          borderRadius={999}
          backgroundColor={palette.paperHole}
          style={{ borderWidth: 1.5, borderColor: palette.paperRing }}
        />
      ))}
    </XStack>
  )
}

/**
 * One confident, slightly organic curve — not a jittery scribble. Two
 * cubic segments instead of straight lines is what reads as "drawn," not
 * "off-model icon."
 */
function HandDrawnCheck({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 12.8 C6 12 7.6 14.8 9.3 17 C12.5 13.2 16.2 8.3 19.6 5.2"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** A wavy pen-stroke strikethrough — drawn, not `textDecorationLine`. Sized to the text's own box, not the row's. */
function CheckedName({ children, color }: { children: string; color: string }) {
  return (
    <YStack style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <Text fontSize={14} fontWeight="700" color={color}>
        {children}
      </Text>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <Path
          d="M2 11 C 15 7, 22 14, 35 10 C 50 6, 60 14, 75 9 C 85 6, 92 11, 98 9"
          stroke={color}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </YStack>
  )
}

/**
 * Deliberately quiet — no scale/spring. A list of many rows all bouncing
 * on hover is what this round's feedback was about; a row just needs a
 * "you're over something" and "you pressed it" signal, not a performance.
 * Hover is an instant background tint (a plain boolean, not animated —
 * that's how hover reads on a real web list); press is a brief, fast
 * opacity dip (120ms timing, no spring) so the tap still registers as
 * felt without adding motion to a list that's already busy with content.
 */
function useQuietRowFeedback() {
  const [hovered, setHovered] = useState(false)
  const [opacity] = useState(() => new Animated.Value(1))
  function pressIn() {
    Animated.timing(opacity, { toValue: 0.6, duration: 100, useNativeDriver: true }).start()
  }
  function pressOut() {
    Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start()
  }
  return { hovered, onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false), opacity, pressIn, pressOut }
}

function ShoppingRow({ item, onToggle, isLast }: { item: ShoppingItem; onToggle: (checked: boolean) => void; isLast: boolean }) {
  const palette = useSoftPalette()
  const row = useQuietRowFeedback()
  return (
    <Pressable
      onPress={() => onToggle(!item.checked)}
      onHoverIn={row.onHoverIn}
      onHoverOut={row.onHoverOut}
      onPressIn={row.pressIn}
      onPressOut={row.pressOut}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={`${item.name}, ${item.quantity.amount} ${item.quantity.unit}`}
      style={pointerCursor}
    >
      <Animated.View
        style={{
          opacity: row.opacity,
          backgroundColor: row.hovered ? palette.layoutSurface : 'transparent',
          borderRadius: 10,
        }}
      >
        <XStack
          alignItems="center"
          gap="$3"
          paddingVertical="$2.5"
          paddingHorizontal="$2"
          minHeight={48}
          style={!isLast ? { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.paperRule } : undefined}
        >
          <YStack
            width={24}
            height={24}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={item.checked ? palette.freshBg : 'transparent'}
            style={{ borderWidth: item.checked ? 0 : 2.5, borderColor: palette.inkSecondary }}
          >
            {item.checked ? <HandDrawnCheck size={15} color={palette.freshText} /> : null}
          </YStack>
          <YStack flex={1}>
            {item.checked ? (
              <CheckedName color={palette.penMark}>{item.name}</CheckedName>
            ) : (
              <Text fontSize={14} fontWeight="700" color={palette.ink}>
                {item.name}
              </Text>
            )}
            <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
              {item.quantity.amount} {item.quantity.unit}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

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
  const toggle = useToggleShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })

  const items = itemsQuery.data ?? []
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  function handleToggle(item: ShoppingItem, next: boolean) {
    toggle.mutate({ itemId: item.id, checked: next })
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
