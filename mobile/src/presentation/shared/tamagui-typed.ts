import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import { Text as UntypedText, XStack as UntypedXStack, YStack as UntypedYStack } from 'tamagui'

/**
 * tamagui@2.7.7's exported component types (YStack, Text, …) lose their style
 * props (padding, gap, justifyContent, textAlign, …) under @types/react@19's
 * revised `ForwardRefExoticComponent` inference: `GetProps<A>` / React's own
 * `ComponentProps<A>` both need to resolve `A extends { __tama: [infer Props,
 * infer Ref, infer NonStyled, infer Base, infer Variants, any] }` and then,
 * from the same conditional, `Props extends TamaDefer ? GetFinalProps<...> :
 * Props` — and collapse to the non-style branch when both steps are inferred
 * together over the full component intersection type. Verified this is not a
 * project misconfiguration: reproduces with moduleResolution left at its
 * default, with `customConditions` removed, with `strict` off, and under
 * typescript@5.6.3 as well as the pinned ~6.0.3 — and no newer 2.x tamagui
 * release exists in this project's `^2.7.7` range to pick up a fix.
 *
 * Decomposing the same `__tama` tuple into two separate conditionals (as
 * below) resolves correctly, so we re-derive each component's prop type here
 * once and re-export under the original name — every call site imports
 * `YStack`/`Text` from here instead of directly from `tamagui`, with the
 * JSX, props, and runtime behavior otherwise unchanged.
 *
 * Scope: only the components actually used with style props in this phase
 * (YStack, XStack, Text). `Button`/`Input` are used here without style props
 * and are unaffected, so they're still imported directly from `tamagui`.
 * `padding`/`gap`/`margin` (and their directional/axis longhands) are
 * widened to accept tamagui's `$`-prefixed spacing tokens (e.g. `"$4"`) in
 * addition to plain RN dimension values — other theme/shorthand/pseudo/media
 * style props are not re-typed here and would need extending this file if a
 * later task starts using them.
 */
type TamaTuple<C> = C extends { __tama: infer T } ? T : never

type SpaceValue = `$${string}` | number | `${number}%`

type SpaceProps =
  | 'padding'
  | 'paddingTop'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingVertical'
  | 'paddingHorizontal'
  | 'gap'
  | 'margin'
  | 'marginTop'
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'
  | 'marginVertical'
  | 'marginHorizontal'

type WithSpaceTokens<T> = Omit<T, SpaceProps> & { [K in SpaceProps]?: SpaceValue }

type StyleProps<C> = TamaTuple<C> extends [
  unknown,
  unknown,
  infer NonStyled,
  infer Base,
  infer Variants,
  unknown,
]
  ? WithSpaceTokens<Omit<NonStyled, keyof Base | keyof Variants> & Base & Variants>
  : never

type RefOf<C> = C extends ForwardRefExoticComponent<infer P>
  ? P extends RefAttributes<infer R>
    ? R
    : never
  : never

function retype<C>(component: C): ForwardRefExoticComponent<StyleProps<C> & RefAttributes<RefOf<C>>> {
  return component as unknown as ForwardRefExoticComponent<StyleProps<C> & RefAttributes<RefOf<C>>>
}

export const YStack = retype(UntypedYStack)
export const XStack = retype(UntypedXStack)
export const Text = retype(UntypedText)
