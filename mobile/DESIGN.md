---
name: Fridge AI
description: A soft household dashboard for a shared fridge — playful, warm, and built entirely on numbers the foyer can act on.
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
  scrim: "rgba(15,43,29,0.40)"
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
- **Accent Warm** (`#FF8A3D`): the second bold hue — the hero card's ember glow (`HeroWarmGlow`), nowhere else. Paired text `#3D1B00` (≈10.6:1) for anything ever set on it. It used to also fill a tilted "12j sans gaspi" streak badge; that badge is gone (2026-09-05) because no "days without waste" concept exists in the domain, so nothing could compute it — it rendered a fixture number to every foyer.

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

Status is derived in exactly one place — `productStatus`/`statusOf` in `src/presentation/dashboard/product-status.ts`. A date already past is `expired`; today through three days out is `soon`; no date at all is `fresh`. The fridge list once carried its own fractional-day copy of this, so the same yoghurt read "Bientôt" on one screen and "Expiré" on the next.

### Scrim
- **Scrim** (`rgba(15,43,29,0.40)` light / `rgba(0,0,0,0.62)` dark): the dimming layer behind a modal `ActionSheet`, and the small circular backdrop behind a camera overlay's close glyph (white-on-white was invisible against a fridge door). Always a token, never an inline literal.

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

**`AppShell` (`src/presentation/shared/app-shell.tsx`) is the layout contract — every screen renders through it, not a per-screen reimplementation.** An audit (2026-08-30) found this chrome copy-pasted independently across four screens, diverging each time, while two screens skipped it entirely — the mobile bottom nav and FAB worked on the dashboard alone. `AppShell` now owns both breakpoints below and the nav chrome; a screen supplies only its own header/content as children plus a `nav` prop:

- **`{ kind: 'tab', tab, onScan }`** — one of the four top-level sections (Accueil/Frigo/Recettes/Courses). Mobile gets the bottom nav; desktop gets the Sidebar with `tab` highlighted.
- **`{ kind: 'stack' }`** — a pushed, non-tab screen (Réglages, Historique des tickets). Mobile carries no bottom nav (the screen renders its own `BackButton` in its header instead); desktop still gets the Sidebar, DESIGN.md's tablet/desktop frame being universal rather than per-screen-opt-in, with nothing highlighted since no tab is active.

**Mobile (< 768px):** a single scrolling column, `paddingHorizontal: 20`, capped at the device width. For `kind: 'tab'` screens, a floating glass pill (current section) + a lime FAB sit fixed at the bottom, overlapping the scroll content by design.

**Tablet/desktop (≥ 768px, `TABLET_BREAKPOINT`, exported from `app-shell.tsx`):** a two-pane frame replaces the phone chrome entirely — no floating pill, no FAB. A fixed 220px sidebar (`layoutSurface` background, no card of its own) sits flush against a white content card (`gradientBottom`) that is centered and width-capped at 640px, with a 16px (`$4`) margin of `layoutSurface` visible on every side of the content card, including the edge facing the sidebar. The whole frame — sidebar and content together — is one `overflow:hidden`, `borderRadius:28` box; the sidebar never has its own separate radius/shadow.

`AppShell` wraps children in its own `ScrollView` by default. A screen that owns a virtualized `FlatList` instead (fridge, receipts) passes `scrollable={false}` and builds its list's `contentContainerStyle` from the exported `shellContentStyle()` + `useAppShellLayout()` helpers, so its padding/max-width still matches every other screen exactly.

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

Every major surface gets its own **asymmetric** corner radius — two opposite corners larger, two smaller — rather than one uniform radius reused everywhere. Three named corner sets rotate across the stat cards and NavCards (`corner="a"|"b"|"c"` in `StatCard`, `"a"|"b"` in `NavCard`) so a row of same-purpose cards still reads as organic, not stamped. The hero card and auth card use a consistent 36/20/36/20 (px) pattern. Full-pill (`999px`) radius is reserved for anything that's a status/action/badge (chips, buttons, the FAB) — never for a content container.

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
- **Selectable chip**: pill, `minHeight:44`, `accent-lime`/`accent-lime-text` when selected and `mint-pale`/`mint-pale-text` when not, always carrying `accessibilityState={{ selected }}`. Used for locations, units, category suggestions, expiry shortcuts and list filters — one shape for "pick one of a few", never a bespoke variant per screen.

### Cards / Containers
- **Hero card / auth card:** asymmetric 36/20/36/20px radius, `hero-mocha` or white fill, hero-lift shadow, a low-opacity warm radial glow (`HeroWarmGlow`) in one corner.
- **Stat card:** flex-1, one of three asymmetric corner sets, pastel fill (cream/lavender/mint-pale), a 36×36 saturated icon chip, card-float shadow.
- **NavCard:** asymmetric corner set, `navcard-teal`/`navcard-violet` fill, an `IllustrationSlot` (blurred radial glow + a bundled 3D illustration or a flat icon fallback tagged "3D · bientôt"), hero-lift shadow, hover/press spring.
- **Internal padding:** `$4` (16px) to `$5` (20px) depending on card size.

### Inputs / Fields (`AuthField`, `FormField`)
Two components, one recipe: `AuthField` on the auth screens, `FormField` (`src/presentation/fridge/form-field.tsx`) everywhere else.
- **Style:** `minHeight` 48 (auth) / 44 (forms) — never a fixed `height`, so large Dynamic Type sizes grow the field instead of clipping it — 12-14px radius, `cream` fill, 2px transparent border, label above.
- **Focus:** border shifts to `accent-lime` (2px) — the only focus treatment in the system; no glow, no shadow change.
- **Error:** `FormField` takes a per-field `error`, which turns the border `expired` and prints the message under that field with `accessibilityLiveRegion="polite"`. `AuthField`'s errors still surface as one `AuthError` coral chip below the stack. A form-wide summary may accompany per-field errors; it must never replace them — an unanchored "un champ est invalide" at the bottom of a long card is not recoverable.
- **Keyboard:** any numeric or date field passes `keyboardType`. Making a user find digits on the alphabetic keyboard while holding groceries is a defect, not a detail.

### Action sheet (`ActionSheet`)
The app's one modal. Options are separate card-buttons on a `layoutSurface` sheet; a `title` (and optional `description`) names what is being decided, a `destructive` option carries `expired-bg`/`expired-text`, and every sheet ends with an "Annuler" row. Any irreversible action on shared household state — deleting a product or a shopping item, removing a member, leaving a foyer, discarding an unsaved form — goes through one, and its copy names the consequence for the rest of the foyer.

### Scan (`useScanSheet`, `ScanScreen`)
The lime FAB means one thing on every tab: scan a product, or scan a receipt. `useScanSheet` owns both the sheet and the two destinations, and iOS's native "search"-role tab renders the same two choices as a real screen. Nothing in the app opens a different scan affordance per screen.

### Navigation
Owned entirely by `AppShell` (see Layout) — no screen wires its own nav chrome.
- **Mobile:** a floating glass pill (`expo-blur` `BlurView`, `intensity:40`, `tint` following the active color scheme via `palette.blurTint` — a hardcoded `tint="light"` shipped once and stayed a light frosted pill in dark mode until caught) showing the current section, plus the lime FAB, both fixed to the bottom, overlapping scroll content. Present on `kind: 'tab'` screens only.
- **Desktop/tablet sidebar (`Sidebar`, `src/presentation/shared/sidebar.tsx`):** `layoutSurface` fill, no border/shadow of its own (part of the shared frame). Five items — Accueil / Frigo / Recettes / Courses, then Réglages (never highlighted: it is a stack screen, not a tab). Active item = full-lime pill with `accent-lime-text` label; inactive items = transparent, `ink` label, `ink-secondary` icon; a `kind: 'stack'` screen shows the sidebar with none active. One `flex:1` spacer pushes the Scanner button to the bottom.

## Do's and Don'ts

### Do:
- **Do** keep `layoutSurface` (`#EEE6DC`) visibly lighter-than-mocha but visibly darker than `gradientBottom` (`#FFFFFF`) — the whole desktop layout depends on that two-step relationship holding.
- **Do** pair every status color with its icon and word (`StatusChip`, `StatusIcon`) — never ship a color-only status indicator.
- **Do** give every new major card its own asymmetric corner set, drawn from (or extending) the existing three-set rotation.
- **Do** set `minHeight:0` on every `flex:1` box in a chain that ends in a `ScrollView` — this is a recurring, real web bug in this codebase, not a style nitpick.
- **Do** honor/press-scale every new Pressable via `useHoverPress` (`src/presentation/shared/hover.ts`) rather than adding a bespoke animation.
- **Do** disclose a placeholder honestly (an unbuilt illustration, an unsent route) — `IllustrationSlot`'s "3D · bientôt" tag exists specifically so an unfinished feature never ships as a silently dead control. The bar rose in 2026-09: a hint is for a genuinely unbuilt feature, never for a control that *could* be wired. "Bientôt disponible" was sitting on the recipe cards, the Recettes FAB and the Courses FAB while every endpoint behind them was already shipped.
- **Do** give every screen its real loading, empty and error states, and put the next action inside the empty one. `return null` while a query settles is a blank white screen with no chrome and nothing to announce; an empty state that only names the void makes the user find their own way out.
- **Do** confirm anything irreversible through an `ActionSheet` that names the consequence — never by swapping a button in place, which turns an impatient double-tap into a deletion on shared state.
- **Do** route every screen through `AppShell` rather than reimplementing BlobBackground/SafeAreaView/ScrollView/Sidebar chrome locally — that duplication is exactly what left the mobile FAB and bottom nav working on the dashboard alone.

### Don't:
- **Don't** hand-roll a screen's own responsive shell (breakpoint check, Sidebar wiring, safe-area, background) — extend `AppShell` instead. This was a real, audited regression: four screens each reimplemented it slightly differently, and two skipped it entirely.
- **Don't** use `#0F2B1D`-family near-black greens anywhere — that was the original hero color, rejected as "too corporate/cold," and the whole warm-mocha identity exists specifically to replace it.
- **Don't** use `chip-teal`/`chip-violet`/`chip-orange` behind white *text* — they measure below 4.5:1 with white text; use the darker `navcard-teal`/`navcard-violet` siblings for anything text-bearing.
- **Don't** add a second dark/high-contrast surface to a screen that already has the hero card — one rich surface per screen, always.
- **Don't** add a visible border/stroke to any container — separation comes from shadow and color contrast only. (A field's 2px focus ring is a state, not a container border; the shopping list's dashed tear-line is a disclosed material exception.)
- **Don't** render product counts, household names or any other domain number from a fixture. The dashboard shipped on `dashboard.fixture.ts` for a while: it named every foyer "Foyer Leroux" and kept claiming 12 products after a 20-item receipt import. A number with no source is worse than no number.
- **Don't** leave a gesture as the only path to an action. The shopping list's edit and delete were swipe-only, which is invisible to a first-timer and unreachable with a screen reader; they now answer to a long press too.
- **Don't** hardcode an SVG gradient `id` as a literal string on a component that can mount more than once in the same DOM (e.g., inside a Stack navigator that keeps prior screens mounted) — use `useId()`. This shipped as a real bug (the sign-up screen's background blob silently failed to render) before being caught.
