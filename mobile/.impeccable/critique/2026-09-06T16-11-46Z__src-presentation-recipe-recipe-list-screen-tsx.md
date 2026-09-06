---
target: the Recettes list screen
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-list-screen.tsx"
target_fingerprint: "sha256:c385a81f75bd9ff630d60a2b2b25953db1775f9b84fcab9bf0e111e32c9092b8"
target_path: /home/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-list-screen.tsx
timestamp: 2026-09-06T16-11-46Z
slug: src-presentation-recipe-recipe-list-screen-tsx
---
Method: dual-agent (A: design review · B: detector + deterministic evidence). No browser/screenshot pass — the user declined it for this session, so every claim below is source- or arithmetic-verified, not seen.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `confirmDeletion` clears `pendingDeletion` before awaiting the mutation: sheet closes, nothing spins, the row sits there for the whole round trip. |
| 2 | Match System / Real World | 3 | Vocabulary is a cook's, but one fraction is spelled three ways on one screen: "2 ingrédients sur 3 chez toi" / "2/3 chez toi" / "2 sur 3 chez toi". |
| 3 | User Control and Freedom | 2 | No undo on a delete that is destructive for the whole foyer; the only trace is a 3.2s auto-dismissing HintBubble. |
| 4 | Consistency and Standards | 2 | The sibling fridge screen pins its identical search+chip block ("scrolling the list must not take them away"); here it scrolls away. `ChipGroupSeparator` imports the appliance token `shelfEdge` onto a screen carrying the mocha hero. |
| 5 | Error Prevention | 2 | The ActionSheet is right, but the detail screen one tap later contradicts the pantry number outright. |
| 6 | Recognition Rather Than Recall | 3 | The chip row has no scroll indicator, no peek and no count — tags 3 and 4 are invisible with zero cue they exist. |
| 7 | Flexibility and Efficiency | 2 | No "j'ai cuisiné", no favourite, no sort. Top-4-by-frequency tags converge on the generator's own boilerplate ('anti-gaspi', 'rapide'), which every recipe carries and which therefore filter nothing. |
| 8 | Aesthetic and Minimalist Design | 3 | Two of MetaChip's four tones are white on cream — 1.08:1, invisible in light mode. |
| 9 | Error Recovery | 3 | `RecipesError` is exemplary and branches before emptiness; `productsQuery.isError` only suppresses numbers, so the whole "Ce soir" thesis evaporates with no message. |
| 10 | Help and Documentation | 3 | The estimate disclosures are real, in-context help; the qualifier is missing from the hero's and alternates' spoken labels. |
| **Total** | | **25/40** | Below average for a shipped screen; the band carries it, the library drags it. |

## Design Specificity Verdict

**LLM assessment.** The top third could not belong to another product. The bottom two thirds could belong to any of them.

Authored for *this* product: `pickTonight` refusing to pad the shortlist; the rescue line naming a product in *this* foyer's fridge in the cook's register; `matchPantry` living in the presentation layer precisely because the backend refuses to guess, with the estimate disclosed rather than laundered; deletion copy that names the household consequence.

Category-interchangeable, and it is the larger half:
- **The thesis is contradicted by one line.** The contract says Recettes "refuses the uniform card feed ordered by creation date." `library` sorts `b.createdAt.localeCompare(a.createdAt)` into a uniform cream feed. The refusal was implemented by adding a band *above* the thing it refused, and leaving that thing untouched.
- **The screen has no idea the foyer is shared.** PRODUCT.md's first principle is "Le foyer est l'unité de vérité"; the stated differentiator against AnyList/Mealime is `householdId` scoping. Here the household appears once — in a delete warning string. No author, no date, no `MemberAvatars`. DESIGN.md made this exact argument to move `MemberAvatars` onto the dashboard.
- **The anti-gaspi loop does not close.** The screen recommends a dish to save the spinach and offers no way to say you cooked it, so tomorrow it recommends the same dish for the same spinach while the dashboard's overdue count climbs.

Cover the hero with your hand and nothing left on screen says fridge, foyer, or gaspillage.

**Deterministic scan.** `detect.mjs --json` over `src/presentation/recipe` and `src/presentation/shared`: exit 0, `[]`, zero findings on both. Grep evidence: 52 hardcoded `fontSize` values, all inside DESIGN.md's documented 11/12/13/14/15/18/20/22/24 scale; every border radius asymmetric per the No-Uniform-Radius rule; 11/11 `Pressable` spread `pointerCursor` and carry both `accessibilityRole` and `accessibilityLabel`; zero literal hex in executable code; zero unpaired `flex:1` in a scroll chain. ESLint: 3 warnings, none in `presentation/`.

The detector caught one thing worth acting on, outside the target: `recipe-detail-screen.tsx:273` renders the literal `→` as UI text beside an existing icon — DESIGN.md's "Don't set a unicode glyph where an icon belongs", the same defect `ArrowLeftIcon` and `PlusIcon` were created to end.

**Visual overlays.** None. No injection was attempted; browser work was declined for this session.

## Overall Impression

Two designs stacked, and only one was committed to. The "Ce soir" band is genuinely excellent — it makes a claim about *your* fridge, refuses to make one when it can't, and says out loud that its match is a guess. The library beneath it is the stock recipe-app feed wearing this system's colours, and it is the taller half.

The single biggest opportunity is not on this screen: there is no "j'ai cuisiné" anywhere in the app. That one action would stop "Ce soir" repeating itself, make the dashboard's counts fall for the right reason, and give the product the only evidence PRODUCT.md calls success.

## What's Working

1. **`pickTonight` returning `[]` rather than padding.** "Ce soir" is never a recommendation for an invented reason. Almost every product ships the opposite, because an empty section looks broken. This one accepts looking empty in exchange for never lying about the fridge, and a test pins it.
2. **The disclosure discipline.** `pantryKnown` returns an empty map rather than a zeroed one while products load — "a row claiming '0 sur 6 chez toi' because the query has not answered is a false statement about a shared fridge, not a loading state" is the correct distinction, correctly implemented.
3. **`CoverageGauge` as an instrument, not a decoration.** Segments capped at 8 with the reason stated, hidden from the screen reader because the adjacent sentence carries the numbers, lime because lime is the progress colour and nothing else.

## Priority Issues

### [P0] The pantry number is contradicted one tap later, on every real recipe
The list computes ownership with `matchPantry`'s name heuristic and prints "2 sur 3 chez toi". `recipe-detail-screen.tsx:122-123` computes it with `productId !== null`, and the backend's `recipe-draft-parser.ts` sets `productId: null` on every AI-generated ingredient — which is all of them. So "Déjà dans ton garde-manger" never renders in production, "À prévoir" always holds everything, and the screen offers to *buy* the spinach the previous screen said you own.

**Why it matters:** the product's core claim, broken across one tap, in the direction that costs money and still wastes the food. It fails silently, and it discredits every other number the app prints.

**Fix:** make `pantry-match.ts` the single source of ownership for both screens — the detail screen calls `matchPantry` and splits on `match.products`, carries `match.estimated` into the heading's disclosure, and gates "ajouter les manquants" on the same set. Note `PantryMatch.estimated` is already computed and read by nobody.

**Command:** `/impeccable harden src/presentation/recipe/`

### [P1] The controls that steer the library scroll away, against the app's own rule
`LibraryControls` sits in `ListHeaderComponent` and scrolls off. The garde-manger's byte-for-byte equivalent is in the pinned `ScreenHeader`, with the comment "they are how you steer the list, so scrolling the list must not take them away."

**Why it matters:** two sibling list screens, same controls, opposite behaviour. Scroll to row 12 with "poulet" typed and a tag on, and the screen shows a short list with nothing explaining why; clearing a filter means scrolling back to the top.

**Fix:** move it into `AppShell`'s pinned block below `ScreenHeader`. If that costs too much first-viewport height, collapse the heading line — don't unpin the controls.

**Command:** `/impeccable layout src/presentation/recipe/recipe-list-screen.tsx`

### [P1] The hero got the precise pass; the two cards beside it did not
Three defects in `TonightAlternate`, all already fixed on the hero: the rescue chip is colour + icon + *the product name* with **no word stating the status** (DESIGN.md: icon **and** colour **and** word); `numberOfLines={1}` on ~140pt of usable width truncates any real product name, which is the exact bug the hero was rebuilt to remove; both alternates share one identical corner set, against the No-Uniform-Radius rule.

**Why it matters:** the rail's hierarchy is "one answer, then the other two." A cook rejecting the lead lands here, and here is where three of the system's own rules break.

**Fix:** give the chip its status word; rotate the alternates through `RecipeCard`'s corner sets by index.

**Command:** `/impeccable polish src/presentation/recipe/tonight-rail.tsx`

### [P1] `hitSlop` is the system's only touch-target strategy, and it does not exist on web
`react-native-web` does not implement `hitSlop`. The new overflow control is 28×28 on web, under the app's own 44 floor — and so is every `Chip`, whose entire justification is "the floor moves off the box and onto the press area." The companion rule (gap must exceed the sum of facing slops) is meaningless where the slop is not applied. Compounding it: no `:focus-visible` treatment on any `Pressable` in `shared/`, so `FormField`'s lime border is the only keyboard-visible focus in the app.

**Fix:** one shared web branch beside `pointerCursor` in `hover.ts` — negative margin plus matching padding — spread by `Chip` and the ellipsis control. DESIGN.md's new "Browser defaults are part of the design" section is already the home for this class of fix.

**Command:** `/impeccable audit src/presentation/shared/hover.ts`

### [P2] Deletion has no pending state and no undo, on shared state
`confirmDeletion` clears `pendingDeletion` before awaiting: the sheet closes, the row stays, nothing indicates work. Then a full `refetch` where `setQueryData` would remove the row instantly. Failure is reported by a toast that removes itself in 3.2 seconds. On a shared library, "I think I deleted our recipe but it's still there" is a genuinely anxious three seconds.

**Fix:** optimistic removal + a pending row state, and an undo affordance inside the hint rather than a self-erasing verdict.

**Command:** `/impeccable harden src/presentation/recipe/recipe-list-screen.tsx`

## Persona Red Flags

**VoiceOver / TalkBack, one hand, kitchen.** The estimate qualifier is missing from the two loudest cards — `recipe-card.tsx:63` deliberately speaks ", estimation", while the hero and the alternates speak `pantrySentence` raw, so a screen-reader user is told a fact the app has documented it cannot know, on exactly the elements that state it most confidently. The hero's label also drops `preparationTime` — rendered as a visible clock pill, described in the code as "the one fact a cook checks before reading anything else", absent from the label. No `accessibilityRole="header"` anywhere: "Ce soir", "Toutes les recettes" and "Recettes" are plain Text, so there is no rotor jump and no live region announcing that the list is now filtered. Neither horizontal rail carries a role or a label.

**One-handed cook, wet hands, large Dynamic Type.** The overflow control sits at the far top-right — the hardest point for a right thumb, on the one destructive action. The hero's clock row is a `flex={1}` title with a hardcoded `lineHeight={28}` beside a `flexShrink={0}` pill: at accessibility sizes the fixed line-height clips a scaled 22px title while the pill refuses to yield. `ALTERNATE_WIDTH = 196` is a fixed constant around a 3-line title and 11px chips that cannot grow. Nothing on the surface sets `maxFontSizeMultiplier`. Three competing gesture regions in the top 400pt, plus a long-press that now duplicates a visible control.

**Desktop / laptop web, 768–872px.** The hero was wider than its column: `columnWidth` was computed from `useWindowDimensions`, but the sidebar (220) and the pane's `$4` margin are not content — at the 768 breakpoint the real measure is 476 while the hero asked for 556. Because the rail is a horizontal ScrollView it did not clip; it silently pushed both alternates off-screen, so the conditional-peek fix did nothing on exactly the widths where the layout is tightest. **Fixed during this run** (see below). Still open: no keyboard focus indicator on any card, chip or pill; and two `MetaChip` tones are white on cream at 1.08:1, so on a large monitor "time" and "muted" read as loose floating text beside the mint and lavender pills — the component's premise ("the tint says which question a pill answers before it is read") is half-false in light mode.

## Fixed during this run

Two findings were verified by arithmetic rather than judgment, so they were repaired rather than filed:

- **The hero's rescue line had dropped below the contrast floor.** Folding the two pills into bare text took `soonOnDark` (`#F0C46E`) off the `heroPillFill` wash it is tuned against: **4.23:1** on bare `brandDeep`, against 6.26:1 on the wash. The wash is back as a 16pt band that wraps instead of hugging — the wrap fault was the pill's shrink-to-fit, not its fill.
- **The desktop column math.** `useAppShellLayout` now returns a real `contentWidth` (window − sidebar − frame padding, capped at the content max-width, padding excluded), and the rail sizes from it. Verified: 476 at 768, correct at every width instead of only above ~872.

One agent claim was checked and is **wrong**: `creamPill` did not break light mode. The light value is `#FFFFFF`, which is what `gradientBottom` already resolved to — the 1.08:1 white-on-cream pill predates the token by the whole build. The token fixed dark mode and inherited an existing light-mode defect. That defect is real and still open.

## Minor Observations

- `ChipGroupSeparator` uses `palette.shelfEdge`, a garde-manger appliance token, on a screen carrying the warm mocha hero — a stated breach of DESIGN.md's Cold-Surface Rule. It needs a neutral hairline token.
- `showsPantryEstimate` gates on `match.total > 0`, i.e. `ingredients.length` — true for essentially every recipe. The disclosure is effectively unconditional; the intended gate was probably `match.estimated`, which is computed and never read.
- The estimate qualifier is now printed twice, ~200pt apart, in near-identical wording. One is honesty; two adjacent trains the eye to skip both.
- `letterSpacing={-0.3}` on the two 20/800 section headings is absent from `ScreenHeader`'s own 20/800 title — screen title and section titles are now optically different at the same nominal step.
- `heading` flips between "Toutes les recettes" and "N résultats" in the same slot at the same weight: the section stops being a place and becomes a readout. And `NoMatches` then says "0 résultat" twice, two lines apart.
- `TIME_BUDGETS` renders nested sets ("15 min ou moins", "30 min ou moins") as sibling toggles; recipes with `preparationTime === null` are silently excluded by any budget filter.
- `EmptyRecipes` says "à partir de ce qu'il faut finir en premier" while holding `products` in hand and naming nothing. First run is the one moment to prove the app knows your fridge, and it recites the pitch.
- The recipe detail screen has no delete action at all — the natural place to decide "we're done with this" is the only place you cannot.
- The `FlatList` has no `getItemLayout` or `initialNumToRender` tuning, and allocates a wrapper `YStack` per row where `ItemSeparatorComponent` belongs.

## Questions to Consider

1. If the library is a reverse-chronological feed anyway, why is it on this screen? What would Recettes become if it opened as the shortlist plus one "Retrouver une recette" row, and stopped pretending to be two products?
2. What happens the morning after? Is "j'ai cuisiné" a v2 feature, or the actual centre of the product that this whole build routed around?
3. Why is a foyer product's most shared artefact anonymous? If a row said "Camille · mardi" or "cuisinée 2 fois", would the library still need search — or just the right sort?
4. The estimate is disclosed three times and acted on zero times. What if tapping a pantry chip let a cook confirm or reject the match, turning the disclaimer into the mechanism that feeds the `productId` the backend refuses to guess?
5. Is "Ce soir" a section, or should it be the screen? It vanishes whenever nothing is due within seven days — and the product argument vanishes with it. "Rien ne presse cette semaine" is an answer no competitor can give, and it currently renders as blank space.
