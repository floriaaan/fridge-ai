/**
 * "Dashboard soft gamifié" — brief pinned by the user 2026-08-27, replacing
 * the previously built "ticket de caisse" direction outright (redesign, not
 * refinement); pushed toward Material Expressive on 2026-08-27 (more color,
 * motion, expressive asymmetric shapes) per follow-up feedback. Every value
 * below is contrast-checked against WCAG 2.1 (≥4.5:1 body text, ≥3:1
 * large/bold) against the surface it sits on — see the commit that
 * introduced this file for the arithmetic. Secondary text on a colored
 * card is always tinted from that card's own hue, never flat neutral gray;
 * plain neutral gray is reserved for labels sitting directly on the
 * near-white background, which the craft floor's "never gray on colored
 * surfaces" rule does not cover.
 *
 * DARK MODE (2026-08-28): a real second design pass, not a palette-swap
 * invert. An early attempt at this literally inverted `brandDeep` to a
 * light lamp-lit amber so the hero would stay "the bright surface" —
 * reasonable-sounding, and wrong: it broke the hero's white text and the
 * hero-pill badges' light status text (soonOnDark/expiredOnDark), both
 * tuned for a dark hero, both dropping under 4.5:1 against a light one.
 * Caught and reverted. The actual fix needed less: `brandDeep` stays
 * byte-for-byte identical to light mode. It's already dark and warm
 * enough (L≈0.10) to read as the lit surface once the *ground* drops to
 * near-black (L≈0.004) around it — the metaphor (a warm pantry at night,
 * one lamp lit) comes from redesigning the ground, ink, layoutSurface,
 * and blob glow, not from flipping every token. Shadows do genuinely
 * invert though: a dark drop-shadow is invisible on an already-dark
 * ground, so dark.shadowCool/shadowWarm are warm light glows.
 */
import { useColorScheme } from 'react-native'
export interface SoftPalette {
  gradientTop: string
  gradientBottom: string
  ink: string
  inkSecondary: string
  brandDeep: string
  brandDeepText: string
  brandDeepTextSecondary: string
  // Pure white used as an icon/text color on saturated fills (StatCard
  // icon chips, NavCard titles) — tokenized so a future dark-mode pass
  // has one place to change instead of hunting down raw "#FFFFFF"
  // literals (an audit finding: 8+ existed before this token did).
  onDark: string
  // The hero card's two status-pill colors (soon/expired), tuned
  // specifically for its dark warm background — distinct from
  // soonText/expiredText below, which are tuned for the light pastel
  // freshBg/soonBg/expiredBg fills instead. Folding these two in is an
  // audit fix: they existed as bare hex literals with no token at all.
  soonOnDark: string
  expiredOnDark: string
  layoutSurface: string
  // The shopping list's paper-list surface + its dashed tear-line between
  // rows — a deliberate, screen-scoped exception to the system's "no
  // borders" rule (see DESIGN.md Shapes), not a drift from it.
  paperCard: string
  paperRule: string
  paperBindingStrip: string
  paperHole: string
  paperRing: string
  penMark: string
  // Two shadow colors, not one — a warm shadow reads right on the warm
  // layoutSurface/hero surfaces, a cooler one on the mint/white ground.
  // Named per the "Warm-Shadow-on-Warm-Ground" rule in DESIGN.md.
  shadowCool: string
  shadowWarm: string
  accentLime: string
  accentLimeText: string
  accentWarm: string
  accentWarmText: string
  blobStrong: string
  blobSoft: string
  chipOrange: string
  chipViolet: string
  chipTeal: string
  navCardTeal: string
  navCardViolet: string
  cream: string
  creamText: string
  lavender: string
  lavenderText: string
  mintPale: string
  mintPaleText: string
  fresh: string
  freshBg: string
  freshText: string
  soon: string
  soonBg: string
  soonText: string
  expired: string
  expiredBg: string
  expiredText: string
  cardShadow: string
}

const light: SoftPalette = {
  gradientTop: '#E9F6D8',
  gradientBottom: '#FFFFFF',
  ink: '#16211A',
  inkSecondary: '#6B7280',
  // Kept dark on purpose — this is the hero card's "sole high-contrast
  // block" (and the auth screens', and status text). Only the *layout
  // surround* (below) got the "too dark, want near-white" softening; the
  // hero staying rich is what makes it a hero.
  brandDeep: '#6B5642',
  brandDeepText: '#FFFFFF',
  brandDeepTextSecondary: 'rgba(255,255,255,0.82)',
  onDark: '#FFFFFF',
  // ~5.4:1 and ~4.6:1 against a rgba(0,0,0,0.28) overlay on brandDeep —
  // see the commit that tuned these when brandDeep was softened; both
  // dropped below 4.5:1 against the lighter mocha at the overlay's
  // original rgba(255,255,255,0.14).
  soonOnDark: '#F0C46E',
  expiredOnDark: '#F0968A',
  // The tablet/desktop layout surround (sidebar included) — near-white
  // with a warm brown tint, deliberately much lighter than brandDeep. The
  // content panel (gradientBottom, #FFFFFF) must read as lighter still —
  // that's the whole "mat around a print" effect — so keep this one a
  // clear step below pure white, never at or above it.
  layoutSurface: '#EEE6DC',
  // Legal-pad yellow, not off-white — the follow-up feedback asked for
  // the notepad cue committed to, not hinted at. Still soft/muted (not
  // neon/highlighter yellow) so it reads as paper, not a warning sticker.
  paperCard: '#F7EFC0',
  paperRule: 'rgba(107,86,66,0.18)',
  paperBindingStrip: '#EEDFA0',
  paperHole: '#C9B76B',
  paperRing: '#D8D8D8',
  penMark: '#2F7D4F',
  shadowCool: '#0F2B1D',
  shadowWarm: '#3A2E20',
  accentLime: '#C4E538',
  accentLimeText: '#0F2B1D',
  accentWarm: '#FF8A3D',
  accentWarmText: '#3D1B00',
  blobStrong: '#BFEE7A',
  blobSoft: '#EAF8D8',
  chipOrange: '#FF8A3D',
  chipViolet: '#8B7FD1',
  chipTeal: '#2FA88A',
  // Darker than chip* on purpose: these carry white *text* (NavCard titles),
  // which needs ≥4.5:1, not the ~3:1 graphics floor a bare icon on chip*
  // gets away with. chipTeal/chipViolet fail 4.5:1 with white text (~2.9:1).
  navCardTeal: '#1F7A62',
  navCardViolet: '#6355A8',
  cream: '#FDF6E8',
  creamText: '#7A6B47',
  lavender: '#EFEAFB',
  lavenderText: '#635B85',
  mintPale: '#E1F3E6',
  mintPaleText: '#3D7A57',
  fresh: '#3FAE6B',
  freshBg: '#DFF3E4',
  freshText: '#1F6B44',
  soon: '#C98A1E',
  soonBg: '#FBEBC7',
  soonText: '#8A5A12',
  expired: '#C6493B',
  expiredBg: '#FBDCD4',
  expiredText: '#B23A2E',
  cardShadow: 'rgba(15,43,29,0.14)',
}

const dark: SoftPalette = {
  // Warm near-black ground, a dim ember-glow blob (not daylight mint) —
  // see BlobBackground/AuthBlobBackground, unchanged code, new colors.
  gradientTop: '#241C12',
  gradientBottom: '#120D08',
  ink: '#F2ECE3',
  inkSecondary: '#B0A597',
  // Deliberately identical to light mode, not inverted: brandDeep
  // (L≈0.10) already sits well above this palette's near-black ground
  // (L≈0.004, ~2.8:1 apart) — warmer-hued and visibly lighter than its
  // surroundings either way, which is what "the one lit surface" thesis
  // actually needs. Inverting it to a light amber (an earlier version of
  // this pass tried that) breaks the hero's white-text pairing and the
  // hero-pill badges' light-colored text (soonOnDark/expiredOnDark),
  // which were tuned for a dark hero and would drop under 4.5:1 against
  // a light one — a real, caught regression, not a hypothetical.
  brandDeep: '#6B5642',
  brandDeepText: '#FFFFFF',
  brandDeepTextSecondary: 'rgba(255,255,255,0.82)',
  onDark: '#FFFFFF',
  soonOnDark: '#F0C46E',
  expiredOnDark: '#F0968A',
  // Content (gradientBottom) stays lighter than the surround
  // (layoutSurface) — the same relative rule as light mode, just shifted
  // into the dark range instead of inverted.
  layoutSurface: '#100C07',
  paperCard: '#2B2410',
  paperBindingStrip: '#3A2F16',
  paperHole: '#4A3B1E',
  paperRing: '#5A5A5A',
  paperRule: 'rgba(242,236,227,0.16)',
  penMark: '#5FCB8B',
  // Shadows as warm light glows, not darkened hex — a shadowColor this
  // dark would be invisible against an already-near-black ground.
  shadowCool: '#F4EBD9',
  shadowWarm: '#FFDDB3',
  accentLime: '#C4E538',
  accentLimeText: '#0F2B1D',
  accentWarm: '#FF9A56',
  accentWarmText: '#2A1200',
  // A dim ember glow, not the light-mode's bright mint "sunlight" —
  // matches BlobBackground's own opacities (0.9/0.55) at these darker
  // values instead of reading as a jarring bright patch on black.
  blobStrong: '#4A3820',
  blobSoft: '#2E2415',
  chipOrange: '#FF9A56',
  chipViolet: '#A79BE0',
  chipTeal: '#3FBFA0',
  navCardTeal: '#1F7A62',
  navCardViolet: '#6355A8',
  cream: '#241F17',
  creamText: '#D9C79A',
  lavender: '#1E1B2A',
  lavenderText: '#C0B7E6',
  mintPale: '#152A1D',
  mintPaleText: '#8FD3A9',
  fresh: '#4FC080',
  freshBg: '#153B25',
  freshText: '#7EDCA5',
  soon: '#E0A93C',
  soonBg: '#3B2C10',
  soonText: '#F0C46E',
  expired: '#E2695A',
  expiredBg: '#3B1712',
  expiredText: '#F0968A',
  cardShadow: 'rgba(0,0,0,0.45)',
}

export function useSoftPalette(): SoftPalette {
  const scheme = useColorScheme()
  return scheme === 'dark' ? dark : light
}
