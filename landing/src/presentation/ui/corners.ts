/** Literal class names so Tailwind's scanner sees every corner utility. */
export const CORNERS = {
  a: 'corners-a',
  b: 'corners-b',
  c: 'corners-c',
} as const

export type CornerSet = keyof typeof CORNERS
