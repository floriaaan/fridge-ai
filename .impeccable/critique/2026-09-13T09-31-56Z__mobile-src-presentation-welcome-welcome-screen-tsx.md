---
target: pre-auth welcome carousel
total_score: 28
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
target_identity: "file:/Users/floriaaan/dev/fridge-ai/mobile/src/presentation/welcome/welcome-screen.tsx"
target_fingerprint: "sha256:a8548bf77ffea5e2d47cb62f683d73c63daef2d3c8b0fc440163b5a287d31d8f"
target_path: /Users/floriaaan/dev/fridge-ai/mobile/src/presentation/welcome/welcome-screen.tsx
timestamp: 2026-09-13T09-31-56Z
slug: mobile-src-presentation-welcome-welcome-screen-tsx
---
Method: dual-agent — two isolated sub-agents (design review + detector/evidence), synthesized below.

## Design Health Score
Applicable max: **36/36** (9 heuristics scored; #10 Help/Documentation is `n/a` — a 3-page carousel with "Passer" always visible needs no help surface, and none exists anywhere pre-auth).

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Dots + label swap ("Commencer" only on last page) state position clearly; no loading state for the photo itself |
| 2 | Match System / Real World | 4/4 | Concrete kitchen-register French copy throughout |
| 3 | User Control and Freedom | 4/4 | Swipe, button, "Passer," and arrow-keys all reach the same destination from any page |
| 4 | Consistency and Standards | 2/4 | Headline ships at 38/40 against DESIGN.md's own `onboarding-display` (44/46) token written for this exact screen; wordmark is hand-rolled instead of reusing `AuthWordmark` |
| 5 | Error Prevention | 3/4 | No destructive actions, but no guard against overlapping/rapid input mid-transition |
| 6 | Recognition Rather Than Recall | 4/4 | Dots + contextual label remove any need to remember position |
| 7 | Flexibility and Efficiency | 3/4 | Arrow-key nav is a real, working accelerator on web |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean, single-focus pages; undercut by the undersized headline and abrupt photo pop-in |
| 9 | Error Recovery | 2/4 | No `onError`/placeholder on any photo — a failed (not just slow) load leaves a permanently blank photo zone |
| 10 | Help and Documentation | n/a | Genuinely not needed here |
| **Total** | | **28/36** | **Good (78%)** |

## Design Specificity Verdict

**LLM assessment**: The file's own prose is unusually rigorous — it explains *why* each geometry decision was made and narrates the exact bug each prior pass fixed. But intent and shipped values have drifted apart in two checkable ways. The comment claims the headline "runs at `onboarding-display` (44/900, DESIGN.md)" — the actual `<Text>` renders `fontSize={38}`/`lineHeight={40}`. DESIGN.md is explicit this token exists *specifically* for this screen, and `AuthShell` gets its own token exactly right one screen later — this isn't a stale doc, it's a shipped regression on the one screen the token was written for. Second, the screen hand-rolls a bare `<Text>FRIDGE</Text>` instead of `<AuthWordmark tone="on-dark" />` — the component that exists specifically to prevent a second copy of this exact lockup — dropping the carrot icon and truncating "FRIDGE AI" to "FRIDGE," breaking the funnel's own "one continuous moment" claim at the one element whose entire job is brand continuity.

**Deterministic scan**: `impeccable detect --json` on the welcome directory → exit 0, zero findings (cross-checked on the single file too). A manual grep pass found one non-hex color literal not routed through a token at the call site (`rgba(15,43,29,…)` in the vignette `LinearGradient` — the comment correctly identifies it as `shadowCool`'s own rgb, just not referenced as `palette.shadowCool` directly) and confirmed: `decelerationRate` is fully gone from the ScrollView (the earlier fix landed cleanly), `Image` (not `Animated.Image`) is used for the photos with no `onLoad`/`defaultSource`/`onError`, and `AuthButton`/"Continuer" precedes "Passer" in DOM order (Tab order matches visual order, despite a stale comment naming them in the opposite order).

**Visual/native-preview evidence**: Unavailable — no reachable dev-server URL in this sandbox, no iOS simulator tooling (`xcrun` present, `simctl` is not). This synthesis rests on tracing the actual transform/layout math by hand against the source, not a screenshot.

## Overall Impression

The carousel mechanics are sound and the width-crush fix from last round is genuinely clean. But this critique surfaced a **new, real bug in the height-smoothing fix applied immediately before this run**: the node `onLayout` measures is the *same* node carrying the entrance `translateY`/`opacity` transform, and clipping a transformed child against its own untransformed measured height clips ~16px off the bottom of the text on every single page transition, not just an edge case. That's the third motion/layout defect on this one screen this session, and — worth saying plainly — this is the first one caught by review rather than by the user manually operating the screen afterward. The pattern underneath all three ("not smooth," "buttons crushed," now this) is the same: two independently-correct pieces of animation logic composed without tracing what changes when they run at the same time, on the same node.

## What's Working

- **The measured-height mechanism is a faithful, correct port of `AuthMethodFooter`'s proven pattern** — first layout sets the value directly with no animation (nothing is ever invisible waiting on a callback), every subsequent layout animates, and the wrapping view only gets an explicit height once measured. That specific risk class (value stuck at an initial 0 with no visible fallback) was correctly avoided this time.
- **Lime stays disciplined** — only the active pagination dot carries it, exactly DESIGN.md's "progress meaning only" rule.
- **The button-stacking fix from last round holds up** — full-width `AuthButton` via `YStack`'s default stretch, no new width logic needed.

## Priority Issues

**[P0] Headline ships at 38/40, not the documented 44/46 `onboarding-display` token.** DESIGN.md wrote this token specifically for this screen's headline; the file's own comment claims it's in use two lines above where it isn't. **Fix**: `fontSize={44}`, `lineHeight={46}`; re-check the longest title ("Le foyer partage la même étagère") wraps acceptably at that size (DESIGN.md's own spec expects 2-3 short lines here, so wrapping itself is fine). → `/impeccable typeset`

**[P0] Hand-rolled wordmark instead of `AuthWordmark`.** Drops the carrot icon and truncates "FRIDGE AI" to "FRIDGE," breaking brand continuity at the one element whose entire job is exactly that, one screen before `AuthShell` renders the full lockup. **Fix**: swap the inline `<Text>` for `<AuthWordmark tone="on-dark" />`. → `/impeccable distill`

**[P1] The measured-height box clips the entrance transform on every page change.** `onLayout` is attached to the same `Animated.View` that carries `opacity`/`translateY([16→0])`. Layout measurement ignores transform, so the box's `overflow:hidden` height is sized to the *untransformed* content — while `translateY` is non-zero (the first ~200ms of every transition), the shifted content's bottom edge sits outside that box and gets clipped. This is the same failure family as the two already-reported "not smooth" bugs: two correctly-reasoned animations composed without tracing their interaction. **Fix**: drop the `translateY` on this element (keep the opacity fade only) — the simplest way to stop a moving node from ever needing more vertical room than its own measured height. → `/impeccable animate`

**[P1] No verification step behind three real motion/layout bugs on one screen.** Each was reasoned correctly in prose, then "confirmed" by re-reading source, not by rendering the screen — which is exactly how the new clip slipped past the fix that was supposed to close out the last one. **Fix**: no code change; going forward, treat "traced the logic" and "watched it run" as two different bars for calling an animation fix done, especially when reusing a pattern into a context (an already-transformed node) the original pattern never had. → `/impeccable audit`

**[P2] Photos have no placeholder, fade-in, or failure state.** A slow connection shows a flat `brandDeep` rectangle that then pops the photo in with no transition — a regression from the previous single-photo build, which faded images in on load. A genuinely failed load never shows anything at all. **Fix**: fade each photo in on its own `onLoad` (independent of the text crossfade), matching the prior build's behavior. → `/impeccable harden`

**[P2] Rapid/overlapping input can interrupt `contentOpacity` mid-fade with a hard cut.** `contentOpacity.setValue(0)` snaps instantly (not animated) at the start of every index-change effect; a swipe landing mid-fade of the previous page, or a button tap racing an in-flight swipe's momentum, cuts opacity abruptly rather than crossfading. Lower priority than the clip above since it only fires on fast/erratic input rather than every normal transition. → `/impeccable harden`

## Persona Red Flags

**Jordan (First-Timer)**: loses the brand lockup on the very first screen, regains it one screen later on sign-up — a small "is this the same app?" flicker at the highest-stakes trust moment. Most likely to be on a weak connection during first install and hit the failed-photo-forever state.

**Casey (Distracted Mobile)**: most exposed to the no-fade photo pop-in (glancing away and back mid-load) and to the opacity-snap race from tapping "Continuer" the instant they look back down.

**Riley (Rapid Swiper)**: will reliably reproduce both the transform-clip (fires on every transition) and the interrupted-fade snap by flicking through all three pages back-to-back — exactly the behavior this persona exists to simulate.

## Minor Observations

- The keyboard-nav comment names "Passer" before "Continuer," the opposite of their actual visual/DOM order — stale wording left over from when they were side-by-side (the claim itself — Tab follows visual order — is still true).
- Pagination dots carry `accessibilityRole="tablist"` on the container, but individual dots are plain non-interactive `View`s with no live-region announcement as the page changes — a screen-reader user hears the count once on mount and nothing after.
- Subtitle sizing is inconsistent within the same funnel: 15px here vs. 13px in `AuthShell`; neither matches DESIGN.md's `body` token (14px) exactly, and the two adjacent screens don't match each other.
- `handleMomentumScrollEnd` computes settle position from `windowWidth` captured at render time — an orientation change mid-carousel could desync the ScrollView's real offset from the next `goTo`'s target.

## Questions to Consider

- If a proven pattern (`AuthMethodFooter`'s measured height) still produced a new defect when copied here, is "reuse a pattern" sufficient review on its own, or does every reuse need its own trace through what's *different* about the new context — here, an already-transformed child — before it's called safe?
- Three motion bugs deep on one screen, all caught the same way (a person opening the app and swiping) — would a short on-device pass before each "fixed" claim have been cheaper than three rounds of reported regressions?
