---
name: Fridge AI
description: A soft, gamified household dashboard for a shared fridge — playful habit-app energy applied to food waste instead of streaks and lessons.
colors:
  ground-mint: "#E9F6D8"
  ground-white: "#FFFFFF"
  ink: "#16211A"
  ink-secondary: "#6B7280"
  hero-mocha: "#6B5642"
  hero-mocha-text: "#FFFFFF"
  on-dark: "#FFFFFF"
  soon-on-dark: "#F0C46E"
  expired-on-dark: "#F0968A"
  layout-surface: "#EEE6DC"
  shadow-cool: "#0F2B1D"
  shadow-warm: "#3A2E20"
  accent-lime: "#C4E538"
  accent-lime-text: "#0F2B1D"
  accent-warm: "#FF8A3D"
  accent-warm-text: "#3D1B00"
  blob-strong: "#BFEE7A"
  blob-soft: "#EAF8D8"
  chip-orange: "#FF8A3D"
  chip-violet: "#8B7FD1"
  chip-teal: "#2FA88A"
  navcard-teal: "#1F7A62"
  navcard-violet: "#6355A8"
  cream: "#FDF6E8"
  cream-text: "#7A6B47"
  lavender: "#EFEAFB"
  lavender-text: "#635B85"
  mint-pale: "#E1F3E6"
  mint-pale-text: "#3D7A57"
  fresh: "#3FAE6B"
  fresh-bg: "#DFF3E4"
  fresh-text: "#1F6B44"
  soon: "#C98A1E"
  soon-bg: "#FBEBC7"
  soon-text: "#8A5A12"
  expired: "#C6493B"
  expired-bg: "#FBDCD4"
  expired-text: "#B23A2E"
typography:
  display:
    fontFamily: "System sans-serif (Tamagui defaultConfig — no custom typeface sourced yet)"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "30px"
  title:
    fontFamily: "System sans-serif"
    fontSize: "20px"
    fontWeight: 800
  body:
    fontFamily: "System sans-serif"
    fontSize: "14px"
    fontWeight: 500
  label:
    fontFamily: "System sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  xxl: "32px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-lime}"
    textColor: "{colors.accent-lime-text}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "50px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.hero-mocha}"
    rounded: "{rounded.pill}"
    height: "50px"
  chip-status:
    backgroundColor: "{colors.fresh-bg}"
    textColor: "{colors.fresh-text}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: Fridge AI

## Overview

**Creative North Star: "The Sunlit Pantry"**

Fridge AI reads as a fitness-app-bright kitchen dashboard: a near-white mint-to-white ground that feels like morning light through a window, one warm-mocha hero surface anchoring the eye like the one wooden shelf in an otherwise bright pantry, and lime accents standing in for fresh produce — the one saturated color the system spends on doing (progress, primary actions), never on decorating. The system went through two corrections to get here: the original hero card was near-black forest green ("too corporate," per feedback) and was warmed into mocha with an ember glow; the desktop layout surround was originally that same dark mocha ("too much brown") and was pulled all the way down to a near-white warm gray so the white content card would still read as the lighter of the two. Both corrections are now load-bearing invariants, not just history — see the Named Rules below.

Status (fresh/soon/expired) is always icon **and** color **and** word — a `StatusChip`/`StatusIcon` pairing carried over from an earlier direction specifically because it survives grayscale and color-blindness, and the team kept it on purpose when the rest of that direction was discarded.

**Key Characteristics:**
- Near-white mint blob ground on mobile; near-white warm-gray "mat" surround with an inset white content card on tablet/desktop — never a flat rectangle gradient, always a soft off-center radial blob.
- Exactly one dark, rich surface (the hero card) carries the "sole high-contrast block" role; everything else is light.
- Lime is reserved for interactive/progress meaning, never decoration.
- Asymmetric corner radii (each major card gets its own, slightly different, corner set) instead of one uniform radius everywhere.
- Every status is icon + color + word, never color alone.
- Every pressable spring-scales on hover (web) and press (all platforms) — a felt, not just visual, response.

## Colors

Warm and near-white by design; color is spent deliberately (lime for action, one warm accent, a handful of pastels) rather than spread evenly across the surface.

### Primary
- **Accent Lime** (`#C4E538`): every interactive/progress element — primary buttons, the FAB, the sidebar's active nav pill, progress fills. Never used decoratively. Pairs with **Accent Lime Text** (`#0F2B1D`) for on-lime labels (≈10.6:1 contrast).

### Secondary
- **Hero Mocha** (`#6B5642`): the one deliberately dark, rich surface in the whole system (the "AUJOURD'HUI DANS TON FRIGO" hero card, the auth-screen equivalent, status toast). Carries white text (`#FFFFFF`, ≈6.9:1) and a low-opacity warm-orange ember glow in one corner for warmth.
- **Accent Warm** (`#FF8A3D`): the second bold hue — the tilted streak badge, nowhere else. Paired text `#3D1B00` (≈10.6:1).

### Tertiary
- **Chip Teal** (`#2FA88A`) / **Chip Violet** (`#8B7FD1`) / **Chip Orange** (`#FF8A3D`): saturated icon-chip fills inside the pastel stat cards — decorative-graphic use only (icons, not text), so they can stay lighter than the 4.5:1 text floor.
- **NavCard Teal** (`#1F7A62`) / **NavCard Violet** (`#6355A8`): darker siblings of Chip Teal/Violet, used only where the color carries white *text* (the Recettes/Courses tile titles) — the chip versions measure ~2.9:1 with white text and fail; these measure ~5-6:1 and pass.

### Neutral
- **Ground Mint → White** (`#E9F6D8` → `#FFFFFF`): the mobile background, a soft off-center radial blob (`BlobBackground`), never a flat top-to-bottom bar.
- **Layout Surface** (`#EEE6DC`): the tablet/desktop layout surround and sidebar — near-white with a warm-brown tint, always a visible step darker than the content card so the "mat around a print" effect reads.
- **Ink** (`#16211A`) / **Ink Secondary** (`#6B7280`): primary and secondary text on near-white grounds. Secondary text sitting on a *colored* card (cream/lavender/mint-pale) is never this flat gray — it's tinted from that card's own hue instead (`#7A6B47` on cream, `#635B85` on lavender, `#3D7A57` on mint-pale).
- **Cream** (`#FDF6E8`) / **Lavender** (`#EFEAFB`) / **Mint Pale** (`#E1F3E6`): the three pastel stat-card backgrounds, always used together as a set of three, never alone.

### Status
- **Fresh** `#3FAE6B` / bg `#DFF3E4` / text `#1F6B44`
- **Soon** `#C98A1E` / bg `#FBEBC7` / text `#8A5A12`
- **Expired** `#C6493B` / bg `#FBDCD4` / text `#B23A2E`

### Named Rules
**The One Dark Surface Rule.** Exactly one surface per screen is allowed to be rich/dark (the hero card, or the auth card's — no, the auth card is white; the hero-equivalent status toast). Two dark surfaces on one screen means the hierarchy broke; the fix is never "make it lighter," it's "which one loses hero status."

**The Layer Must Lighten Rule.** On tablet/desktop, `layoutSurface` (the surround) must always be visibly darker than `gradientBottom` (the content card). If a future token change makes them equal or inverts them, the inset-card effect the whole layout depends on disappears — this was a real regression once already.

## Typography

**Body/Display Font:** System sans-serif (Tamagui `defaultConfig`'s platform stack) — **no custom typeface has been sourced yet.** The brief calls for "une seule famille sans-serif géométrique" (one geometric sans); that choice is still open. Treat any font-family value in this document as a placeholder, not a commitment.

**Character:** Hierarchy is built on size and weight only — never color. A label is always small/regular/secondary-toned above; a value is always larger/bold/ink-toned below.

### Hierarchy
- **Display** (800, 24px, 30px line-height): the hero headline ("3 produits à surveiller").
- **Title** (800, 20px): screen/card titles ("Content de te revoir", household name).
- **Value** (800, 22px): stat-card numbers (StatCard's `value`).
- **Body** (500–600, 13–14px): form fields, product names, nav labels.
- **Label** (500–700, 10–13px): secondary captions, status chip text, stat-card labels — always uppercase-optional, never colored for hierarchy alone.

### Named Rules
**The Size-and-Weight-Only Rule.** No token in this system uses color to create hierarchy between a label and its value. If a screen needs a label to stand out more, the fix is size or weight, never a brighter ink color.

## Layout

**Mobile (< 768px):** a single scrolling column, `paddingHorizontal: 20`, capped at the device width. A floating glass pill (current section) + a lime FAB sit fixed at the bottom, overlapping the scroll content by design.

**Tablet/desktop (≥ 768px, `TABLET_BREAKPOINT`):** a two-pane frame replaces the phone chrome entirely — no floating pill, no FAB. A fixed 220px sidebar (`layoutSurface` background, no card of its own) sits flush against a white content card (`gradientBottom`) that is centered and width-capped at 640px, with a 16px (`$4`) margin of `layoutSurface` visible on every side of the content card, including the edge facing the sidebar. The whole frame — sidebar and content together — is one `overflow:hidden`, `borderRadius:28` box; the sidebar never has its own separate radius/shadow.

Every `flex:1` box in a scrollable chain declares `minHeight:0` explicitly — a CSS default (`min-height:auto`) that silently breaks nested scroll containers on web and was the root cause of two real layout bugs during this build.

## Elevation & Depth

Hybrid: flat color fields for status/pastel surfaces, wide/soft/low-opacity shadows for anything meant to feel like it's floating (cards, the FAB, the sidebar+content frame). No hard-edged or high-opacity shadows anywhere — the "wide, diffuse, low-opacity" shadow is a direction invariant from the original brief.

### Shadow Vocabulary
- **Card-float** (`shadowColor:'#0F2B1D', offset:{0,10}, opacity:0.1, radius:18-20`): stat cards, the "Périme bientôt" / recipe-suggestion list containers.
- **Hero-lift** (`shadowColor:'#0F2B1D', offset:{0,16}, opacity:0.22, radius:28`): the hero card, NavCards — heavier than card-float because these carry more visual weight.
- **Frame-lift** (`shadowColor:'#3A2E20', offset:{0,10}, opacity:0.16, radius:22`): the desktop content-card-inside-frame shadow — warmer shadow color than the others (`#3A2E20` vs `#0F2B1D`) because it sits against the warm `layoutSurface`, not the mint ground.
- **FAB-lift** (`shadowColor:'#0F2B1D', offset:{0,10}, opacity:0.28, radius:16`): the floating action button, the most elevated single element on the mobile screen.

### Named Rules
**The Warm-Shadow-on-Warm-Ground Rule.** A shadow cast onto `layoutSurface` uses a warm shadow color (`#3A2E20`); a shadow cast onto the mint/white ground uses the cooler `#0F2B1D`. Matching the shadow's undertone to what it falls on is why the frame reads as sitting *in* the surround rather than pasted on top of it.

## Shapes

Every major surface gets its own **asymmetric** corner radius — two opposite corners larger, two smaller — rather than one uniform radius reused everywhere. Three named corner sets rotate across the stat cards and NavCards (`corner="a"|"b"|"c"` in `StatCard`, `"a"|"b"` in `NavCard`) so a row of same-purpose cards still reads as organic, not stamped. The hero card and auth card use a consistent 36/20/36/20 (px) pattern. Full-pill (`999px`) radius is reserved for anything that's a status/action/badge (chips, buttons, the streak badge, the FAB) — never for a content container.

No borders anywhere in the system. Separation between surfaces is color contrast and shadow, never a stroke.

### Named Rules
**The No-Uniform-Radius Rule.** If two adjacent cards in a row share an identical corner radius, that's a miss, not a simplification — pull one of the three named corner sets instead.

## Components

### Buttons (`AuthButton`, the FAB, the sidebar Scanner button)
- **Shape:** full pill (`999px`), height 50px (auth buttons) or 56×56 circle (FAB).
- **Primary:** `accent-lime` background, `accent-lime-text` label, no border.
- **Secondary:** transparent background, 2px `hero-mocha` border, `hero-mocha` label (the PocketID button).
- **Hover / Press:** every button spring-scales via `useHoverPress` — ×1.035 on web hover, ×0.96 on press-in, spring back on release. Disabled state drops opacity to 0.6 and disables the press handler; the label swaps to a `pendingLabel` ("Connexion...", "Inscription...") rather than adding a spinner.

### Chips
- **Status chip** (`StatusChip`): pill, status-bg fill, status-text label + a matching icon (`CircleCheckIcon`/`TriangleAlertIcon`/`CircleXIcon`) — always icon+color+word together.
- **Streak badge**: pill, `accent-warm` fill, tilted −3° to −4° (the one intentionally-rotated element in the system — a "sticker," used exactly once).

### Cards / Containers
- **Hero card / auth card:** asymmetric 36/20/36/20px radius, `hero-mocha` or white fill, hero-lift shadow, a low-opacity warm radial glow (`HeroWarmGlow`) in one corner.
- **Stat card:** flex-1, one of three asymmetric corner sets, pastel fill (cream/lavender/mint-pale), a 36×36 saturated icon chip, card-float shadow.
- **NavCard:** asymmetric corner set, `navcard-teal`/`navcard-violet` fill, an `IllustrationSlot` (blurred radial glow + a bundled 3D illustration or a flat icon fallback tagged "3D · bientôt"), hero-lift shadow, hover/press spring.
- **Internal padding:** `$4` (16px) to `$5` (20px) depending on card size.

### Inputs / Fields (`AuthField`)
- **Style:** 48px height, 14px radius, `cream` fill, 2px transparent border, label above in `ink-secondary`.
- **Focus:** border shifts to `accent-lime` (2px) — the only focus treatment in the system; no glow, no shadow change.
- **Error:** surfaced below the field stack as an `AuthError` coral chip (`expired-bg`/`expired-text`), not inline per-field.

### Navigation
- **Mobile:** a floating glass pill (`expo-blur` `BlurView`, `intensity:40`) showing the current section, plus the lime FAB, both fixed to the bottom, overlapping scroll content.
- **Desktop/tablet sidebar:** `layoutSurface` fill, no border/shadow of its own (part of the shared frame). Active item = full-lime pill with `accent-lime-text` label; inactive items = transparent, `ink` label, `ink-secondary` icon. One `flex:1` spacer pushes the Scanner button to the bottom.

## Do's and Don'ts

### Do:
- **Do** keep `layoutSurface` (`#EEE6DC`) visibly lighter-than-mocha but visibly darker than `gradientBottom` (`#FFFFFF`) — the whole desktop layout depends on that two-step relationship holding.
- **Do** pair every status color with its icon and word (`StatusChip`, `StatusIcon`) — never ship a color-only status indicator.
- **Do** give every new major card its own asymmetric corner set, drawn from (or extending) the existing three-set rotation.
- **Do** set `minHeight:0` on every `flex:1` box in a chain that ends in a `ScrollView` — this is a recurring, real web bug in this codebase, not a style nitpick.
- **Do** honor/press-scale every new Pressable via `useHoverPress` (`src/presentation/shared/hover.ts`) rather than adding a bespoke animation.
- **Do** disclose a placeholder honestly (an unbuilt illustration, an unsent route) — `IllustrationSlot`'s "3D · bientôt" tag and the app-wide "bientôt disponible" hint pattern exist specifically so an unfinished feature never ships as a silently dead control.

### Don't:
- **Don't** use `#0F2B1D`-family near-black greens anywhere — that was the original hero color, rejected as "too corporate/cold," and the whole warm-mocha identity exists specifically to replace it.
- **Don't** use `chip-teal`/`chip-violet`/`chip-orange` behind white *text* — they measure below 4.5:1 with white text; use the darker `navcard-teal`/`navcard-violet` siblings for anything text-bearing.
- **Don't** add a second dark/high-contrast surface to a screen that already has the hero card — one rich surface per screen, always.
- **Don't** add a visible border/stroke to any container — separation comes from shadow and color contrast only.
- **Don't** hardcode an SVG gradient `id` as a literal string on a component that can mount more than once in the same DOM (e.g., inside a Stack navigator that keeps prior screens mounted) — use `useId()`. This shipped as a real bug (the sign-up screen's background blob silently failed to render) before being caught.
