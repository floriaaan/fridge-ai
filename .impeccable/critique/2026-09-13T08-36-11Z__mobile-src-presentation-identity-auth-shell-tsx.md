---
target: pre-auth funnel (welcome + sign-in/sign-up)
total_score: 21
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:/Users/floriaaan/dev/fridge-ai/mobile/src/presentation/identity/auth-shell.tsx"
target_fingerprint: "sha256:8ad9a0903e26cd34bcf8ab62a60991bfc21e50761365a09ede3bfbba62132fe3"
target_path: /Users/floriaaan/dev/fridge-ai/mobile/src/presentation/identity/auth-shell.tsx
timestamp: 2026-09-13T08-36-11Z
slug: mobile-src-presentation-identity-auth-shell-tsx
---
Method: dual-agent (Assessment A: design review · Assessment B: detector + evidence, run as two isolated sub-agents)

## Design Health Score

Applicable max: **32/32 possible categories** (heuristics 7 – Flexibility/Efficiency – and 10 – Help/Documentation – marked `n/a`: this is a 2-screen native pre-auth funnel with no power-user path and no help surface to score).

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | `AuthButton`'s spinner+label swap is solid; undercut by a back-link that's present in the tree but not perceptible, and PocketID popping in/out of existence with no loading affordance while `useAuthMethodsQuery` is in flight |
| 2 | Match System / Real World | 3/4 | Warm "cook, not inspector" French copy throughout — drops to generic system-speak exactly at the highest-stakes moment (auth failure text) |
| 3 | User Control and Freedom | 2/4 | The only way back from the e-mail form destroys typed input with zero confirmation, and the control itself is barely visible |
| 4 | Consistency and Standards | 2/4 | `← Autre méthode` is a literal unicode glyph — DESIGN.md names this exact anti-pattern and its fix (`ArrowLeftIcon`) from a *previous* bug; the wordmark itself also disagrees between welcome ("FRIDGE") and auth ("FRIDGE AI" + carrot) |
| 5 | Error Prevention | 2/4 | No client-side gate on empty fields (unlike the very next screen, `ThresholdScreen`'s `canCreate`/`canJoin`) — an empty submit becomes a real network round trip |
| 6 | Recognition Rather Than Recall | 4/4 | Nothing asks the user to remember anything across screens |
| 7 | Flexibility and Efficiency | n/a | No power-user path exists or is expected in a 2-screen native auth funnel |
| 8 | Aesthetic and Minimalist Design | 4/4 | Genuinely restrained: one CTA on welcome, a two-state chooser instead of a dense form up front |
| 9 | Error Recovery | 1/4 | Generic, non-actionable error copy; `AuthError` has no live-region/alert role, so a failed sign-in is silent to a screen reader; a failed `useAuthMethodsQuery` is indistinguishable from "no SSO configured" |
| 10 | Help and Documentation | n/a | No help surface exists or is expected here |
| **Total** | | **21/32** | **Acceptable (66%)** |

## Design Specificity Verdict

**LLM assessment**: Mostly authored for Fridge AI, not a generic template, and worth saying plainly. The welcome screen and `AuthShell` both reuse the *exact* hero-card geometry from the in-app dashboard (asymmetric 36/20 corners, `HeroWarmGlow`, `brandDeep`), one photo (`KITCHEN_PHOTO_URI`) threads across welcome → sign-in → sign-up so the funnel reads as one continuous moment, the carrot wordmark and PocketID (a real self-hosted SSO provider, not "Sign in with Generic OAuth") are specific choices, and the copy speaks in the shared-household register the rest of the app establishes. Nobody would mistake this for a stock auth template.

It weakens exactly where it's tested hardest: the failure copy ("Une erreur est survenue lors de la connexion.") is interchangeable with any app's default string, the back-link out of the e-mail form is a bare, near-invisible label rather than a considered control, and a first-time visitor is greeted as a returning one. The authorial voice is real, but it evaporates under stress — which is the opposite of where specificity is supposed to prove itself.

**Deterministic scan**: `impeccable detect --json` on both target directories returned exit 0, zero findings. This is a real gap in the detector's coverage for this codebase, not a clean bill of health: it did not catch the literal `←` glyph in JSX text (a documented, previously-fixed anti-pattern in this exact project's own DESIGN.md), because that class of check is apparently not part of its ruleset for React Native text content. The secondary grep pass (run manually, not by the detector) found: two raw hex literals in `invite-share-card.tsx` (`#FFFFFF`/`#16211A` on a QR code — likely a legitimate exception, since QR scannability needs true white, but outside this file's normal palette-token discipline and worth a one-line acknowledgment in DESIGN.md rather than a silent literal); the `#fff` inside `pocket-id-icon.tsx`'s vendored raw SVG string (fine — it's inlined third-party icon markup, not a styling decision); and confirmed that `AuthFocusContext`'s `AuthFocusProvider` is exported but imported nowhere in the app, while `useNotifyAuthFocus()` is still actively called from `AuthField` on every focus/blur, safely no-op-ing against no listener.

**Visual/native-preview evidence**: Unavailable for this run. This is a native React Native app with no reachable dev-server URL in this sandbox (a prior attempt this session to start the Expo web server hung on what looks like a blocked network call), and no iOS simulator tooling is installed (`xcrun` exists; `simctl` does not). No browser overlay exists to point you to — this synthesis rests on source reading plus this session's own live-device bug history, not a screenshot.

## Overall Impression

The bones are good — restrained, on-brand, and the hardest interaction problem in this funnel (the method-chooser's expand-into-a-form transition) is solved properly, by measuring real content instead of guessing a constant. But this exact funnel has now shipped three separate "technically renders, functionally invisible" contrast bugs against the same dark panel this session (`AuthButton`, `PocketIdIcon`, `AuthField`'s label), and a fourth just turned up in this critique on the back-link — plus the literal `←` glyph DESIGN.md already named as a fixed-once anti-pattern. The single biggest opportunity here isn't more polish, it's closing the actual gap: nothing in this funnel's build process has been checking new controls against DESIGN.md's own already-written rules before they ship.

## What's Working

- **`AuthMethodFooter`'s measured-height expansion.** Rather than a guessed pixel constant for the choice→email transition, it measures real content via `onLayout`, renders unconstrained until the first measurement lands (never blank on mount), and only then hands control to the animated height. This is a well-solved hard problem, built correctly on the second attempt after a related feature (fullscreen-on-focus) broke from doing the harder, riskier version of the same idea.
- **Motion discipline survived the churn.** Every animated value in this funnel (`contentOpacity`, `entrance`, the footer's `height`) branches on `useReduceMotion()`, and every field uses `minHeight` never `height` for Dynamic Type. Easy details to drop mid-revert; they weren't.
- **Cross-screen continuity.** One photo, one hero-panel language, shared between welcome and both auth screens — a deliberate choice that makes the funnel feel like one place instead of a generic flow bolted onto a different-looking app.

## Priority Issues

**[P0] The "back to chooser" link is both unreadable and destructive.**
- **Why it matters**: `auth-method-footer.tsx`'s `← Autre méthode` renders in `palette.inkSecondary` on the `brandDeep` panel — roughly 1.4:1 contrast in light mode, 2.9:1 in dark, both well under WCAG AA's 4.5:1 floor. It's also a literal `←` character, the exact glyph-instead-of-icon anti-pattern DESIGN.md documents as previously shipped and fixed elsewhere in this app. And pressing it — even by accident, reaching for a field one-handed — unmounts the form and discards whatever was typed, with no confirmation. This is the fourth black-on-`brandDeep` contrast bug in this funnel this session; the pattern keeps slipping through.
- **Fix**: Swap the color for `palette.onDarkSecondary` (already proven ~5.5:1 on this exact panel elsewhere in the file), replace `←` with `ArrowLeftIcon`, and stop silently discarding non-empty fields on a stray tap.
- **Suggested command**: `/impeccable harden`

**[P1] First-time visitors are routed to Sign-In and greeted as returning users.**
- **Why it matters**: `welcome.tsx` always sends "Commencer" to `/(auth)/sign-in`, which opens on "Content de te revoir" ("Glad to see you again"). Every single visitor reaching this screen has, by construction, never used the app before — the welcome screen only ever shows once, before an account exists. They're told the opposite of the truth and have to notice a 13px secondary link to find the sign-up form they actually need, directly undercutting welcome's own job as "the one decisive moment."
- **Fix**: Route "Commencer" to sign-up (nobody arriving here has an account), or vary sign-in's copy for a fresh install.
- **Suggested command**: `/impeccable clarify`

**[P1] `AuthError` is silent to screen readers.**
- **Why it matters**: `auth-error.tsx` is a plain `<Text>` with no `accessibilityLiveRegion` or alert role — unlike `FormField`, the sibling component it was modeled on, which DESIGN.md documents as carrying exactly this. A screen-reader user whose sign-in fails hears nothing at all; the button just stops spinning. This is precisely the "unclear feedback at a high-stakes moment" failure the whole funnel otherwise avoids.
- **Fix**: Add `accessibilityLiveRegion="polite"` and `accessibilityRole="alert"`; consider a regression test the way `query-error-branch.test.ts` pins the equivalent list-screen rule.
- **Suggested command**: `/impeccable harden`

**[P2] No client-side validation; error copy doesn't distinguish causes.**
- **Why it matters**: `LoginForm`/`SignupForm` never gate `AuthButton` on field contents (`ThresholdScreen`, one screen later in the same funnel, already does this via `canCreate`/`canJoin`). An empty-field tap becomes a real network round trip that returns the same generic "Une erreur est survenue lors de la connexion." regardless of whether the password was wrong, the network dropped, or a field was blank.
- **Fix**: Gate submission the same way `ThresholdScreen` does; reuse or extend its `errorMessage` helper (which already distinguishes a network failure) instead of one flat string.
- **Suggested command**: `/impeccable harden`

**[P2] PocketID silently disappears on slow network or query failure.**
- **Why it matters**: `pocketId` in `AuthMethodFooter` is `authMethods.data?.find(...)` — loading, a slow connection, and an outright failed query are all indistinguishable `undefined`, so the "ou" divider and PocketID button simply never appear, with no spinner, no error, no retry. A household that uses PocketID SSO and hits a flaky connection sees no path in at all, with no signal that anything went wrong. This is the same shape of bug DESIGN.md's `isError`-before-emptiness rule already exists to prevent elsewhere in the app.
- **Fix**: Branch on `authMethods.isError` explicitly rather than folding it into "no data yet."
- **Suggested command**: `/impeccable harden`

**[P3] Orphaned `AuthFocusContext` from the reverted fullscreen-on-focus feature.**
- **Why it matters**: `AuthFocusProvider` is exported and imported nowhere; `AuthField` still calls `useNotifyAuthFocus()` on every focus/blur, no-oping safely today. Harmless now, but it reads as live wiring to the next person who touches this file, and risks convincing a future attempt at the fullscreen-on-focus feature that half its plumbing is already validated when it's dead code nobody has exercised.
- **Fix**: Delete the context and the `AuthField` call now, or leave an explicit "reverted, not wired" comment at the call site.
- **Suggested command**: `/impeccable distill`

## Persona Red Flags

**Jordan (First-Timer)**: Taps "Commencer," lands on "Content de te revoir" despite never having opened the app before. Has to notice a 13px secondary link at the bottom of the sign-in card to find the sign-up form they actually need — a first-run flow working against its own first-time visitor.

**Casey (Distracted Mobile User)**: Filling in the sign-up form one-handed, the only way back to the method chooser is a ~1.4–2.9:1-contrast label sitting directly above the input stack — easy to miss, easy to fat-finger, and either way a stray tap wipes the name/email/password just typed with zero confirmation. If Casey also submits an empty field (no client-side gate), the reward is "Une erreur est survenue" with no indication of what to fix.

**Sam (Accessibility-Dependent User)**: Types the wrong password; VoiceOver/TalkBack announces nothing when it fails, since `AuthError` carries no live region or alert role — the button just stops spinning, at the exact moment the app most needs to say something. Independently hits the same back-link contrast failure as Casey.

## Minor Observations

- The welcome screen hand-rolls its own "FRIDGE" wordmark + vignette instead of reusing the shared `AuthWordmark`/`AuthPhotoBackground` the auth screens use — a small crack in the "one continuous moment" the funnel otherwise earns.
- `AuthDivider`'s own comment ("its one remaining caller") implies a shrinking caller list — worth confirming it isn't itself mid-cleanup.
- `AuthButton`'s `tone="on-dark"` comment is genuinely good inline reasoning explaining a prior bug and its fix — more of this pattern, checked proactively against new controls, would have caught the back-link before it shipped.
- Neither `LoginForm` nor `SignupForm` trims `email`/`password`, unlike `ThresholdScreen`'s `householdName.trim()` — trailing whitespace from autofill could produce a confusing false-negative login.
- `invite-share-card.tsx`'s two raw hex literals for the QR code are a defensible exception (true white is a scanability requirement), but undocumented as one — a one-line DESIGN.md note would turn it from a silent literal into a disclosed exception, the pattern the fridge cabinet and shopping-list "material exceptions" already use elsewhere in this doc.

## Questions to Consider

- This funnel shipped a totally silent, no-buttons-at-all failure once already this session. Given that history, should new controls here get a deliberate DESIGN.md-rules pass (contrast on the actual ground color, no bare glyphs) before shipping, rather than after a user reports them broken?
- Why does this funnel's error copy regress in quality relative to the very next screen in the same product (`ThresholdScreen`'s `errorMessage` helper already exists and already does better)?
- Is routing every first-time device through sign-in-first a deliberate bet (most households already have a PocketID account), or an artifact of building sign-in before sign-up and never revisiting the default?
