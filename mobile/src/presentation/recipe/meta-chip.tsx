/**
 * The small facts under a recipe's name: how much of it is already in the
 * garde-manger, how long it takes, what it is.
 *
 * Three tones rather than one, because a row of identically tinted pills reads
 * as one undifferentiated list of words — and this is the only distinction
 * available: DESIGN.md bans repeating a single glyph down a list of rows, so
 * these carry no icons at all. The tint is what says which question a pill
 * answers before it is read.
 */
import { Text, XStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export type MetaTone = 'pantry' | 'time' | 'tag' | 'muted'

export function MetaChip({ label, tone, palette }: { label: string; tone: MetaTone; palette: SoftPalette }) {
  const fills: Record<MetaTone, { background: string; color: string }> = {
    pantry: { background: palette.mintPale, color: palette.mintPaleText },
    // `creamPill`, not `cream` (invisible on the card it sits on) and not
    // `gradientBottom` (that is the page ground: in dark mode it punched a hole
    // through the row instead of drawing a pill on it).
    time: { background: palette.creamPill, color: palette.creamText },
    tag: { background: palette.lavender, color: palette.lavenderText },
    muted: { background: palette.creamPill, color: palette.inkSecondary },
  }
  /**
   * `creamPill` against `cream` measures 1.08:1 in light mode — the same
   * white-on-cream the old `gradientBottom` fill had, inherited rather than
   * introduced. A fill that close is not a pill, it is loose floating text, and
   * this component's whole premise is that the tint says which question a pill
   * answers *before* it is read. Below the separation a fill can carry on its
   * own, the shape has to do the work instead: a hairline of the label's own
   * ink, which is neither a container border (this is a control-sized mark, not
   * an outlined surface) nor a second colour in the palette.
   */
  const needsEdge = tone === 'time' || tone === 'muted'
  const fill = fills[tone]
  return (
    <XStack
      backgroundColor={fill.background}
      borderRadius={999}
      paddingVertical="$1"
      paddingHorizontal="$2.5"
      style={needsEdge ? { borderWidth: 1, borderColor: palette.creamPillEdge } : undefined}
    >
      <Text fontSize={11} fontWeight="700" color={fill.color}>
        {label}
      </Text>
    </XStack>
  )
}
