/**
 * A hairline between two groups of chips sharing one scrolling line.
 *
 * The garde-manger's row carries two axes — *how long has it got* (the expiry
 * windows) and *where is it* (the compartments) — and they are not
 * alternatives to each other: one of each can be on at the same time. Without
 * a break the row reads as one list of mutually exclusive options. Recettes
 * has the same shape (a time budget, then the tags) and reuses this rather
 * than redrawing it: a second copy is how the three chip implementations this
 * app already consolidated came about.
 *
 * A hairline is not a container border (DESIGN.md's ban is on outlining
 * surfaces); it is a mark *between* two groups of controls, which is the one
 * job a rule does better than colour or shadow inside a single scrolling line.
 *
 * It draws in `paperRule`, not `shelfEdge`. `shelfEdge` belongs to the
 * garde-manger's cold enamel appliance, and DESIGN.md's Cold-Surface Rule says
 * those tokens never appear on a screen that also carries the warm hero card —
 * which Recettes does. `paperRule` is this system's neutral hairline, already
 * carrying the ink at the right opacity in both modes.
 */
import { YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function ChipGroupSeparator({ palette }: { palette: SoftPalette }) {
  return <YStack width={1} height={20} borderRadius={1} backgroundColor={palette.paperRule} marginHorizontal="$1" />
}
