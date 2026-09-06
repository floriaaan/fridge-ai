---
version: 1
slug: "src-presentation-recipe-recipe-list-screen-tsx"
primary_target: "src/presentation/recipe/recipe-list-screen.tsx"
related_targets: ["src/presentation/recipe/recipe-card.tsx"]
---

Scope: `(tabs)/recipes` index — the Recettes tab list. Visitor mode: Operate.

Audience: a foyer member standing in the kitchen, deciding the evening meal. Task: pick one dish now; find a kept recipe second. Constraint: the backend never links an AI recipe's ingredients to real products (`recipe-draft-parser.ts` refuses fuzzy matching), so any pantry coverage shown here is a mobile-side name heuristic and must be labelled as an estimate, never as a fact.

Unresolved: no image on a recipe (`imageKey` is always null); no "cooked it" action that consumes products.

## Direction contract

THESIS: Recettes answers "on mange quoi ce soir", not "quelles recettes ai-je gardées". It refuses the uniform card feed ordered by creation date.

OWN-WORLD: the committed Sunlit Pantry — mint blob ground, exactly one mocha hero surface, lime spent only on progress and action, asymmetric corner sets, shipped `Chip` / `PillButton` / `FormField` / `ActionSheet`.

STORY: the cook sees one dish that saves a product about to expire, two alternates beside it, then searches or filters the library, and can delete a recipe the foyer is done with.

FIRST VIEWPORT: pinned header — chef glyph, "Recettes", count, lime "Générer" pill trailing. Below, "Ce soir": a full-width mocha hero card naming the product it rescues, its expiry line and an estimated coverage gauge, followed by a horizontal rail of lighter alternate cards. Then the search field and one scrolling chip line, then the library as compact `cream` rows — never `gradientBottom`, which is the desktop content card itself.

FORM: "Deux temps", candidate 4 of seven, seed key e7b6009e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
