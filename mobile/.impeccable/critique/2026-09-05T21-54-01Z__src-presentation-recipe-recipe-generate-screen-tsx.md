---
target: parcours de génération de recette
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-generate-screen.tsx"
target_fingerprint: "sha256:9052c40a6f378a10e01324dcc41a9eb993e67ff35b5587c7cc68e62b68e3e8be"
target_path: /home/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-generate-screen.tsx
timestamp: 2026-09-05T21-54-01Z
slug: src-presentation-recipe-recipe-generate-screen-tsx
---
`Method: dual-agent (A: revue design · B: scan déterministe)`

## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|---|---|---|
| 1 | Visibilité de l'état système | 3 | `GeneratingOverlay` exemplaire. Mais un succès qui renvoie `[]` ferme la feuille sans rien dire. |
| 2 | Adéquation au monde réel | 3 | « Contraintes » = mot de fiche technique ; tout le registre péremption est celui d'un inspecteur sanitaire. |
| 3 | Contrôle et liberté | 2 | « Tout effacer » balaie 24 décisions sans `ActionSheet`. Aucune annulation pendant l'overlay bloquant. |
| 4 | Cohérence et standards | 2 | Header rehandroulé alors que `ScreenHeader` accepte `trailing`. Chip d'erreur sans icône. `SparklesIcon` ambigu (IA vs texte utilisateur). |
| 5 | Prévention des erreurs | 2 | Un garde-manger vide atteint le bouton ; l'app sait déjà que ça échouera. |
| 6 | Reconnaissance vs rappel | 2 | `describeWish()` importé par rien sauf son test. Conçue, testée, jamais câblée. |
| 7 | Flexibilité et efficacité | 2 | Chemin un-tap préservé. Mais aucun préréglage ni défaut foyer. |
| 8 | Esthétique et minimalisme | 3 | Corner sets distincts, `gap="$3"` respecté. Mais 24 options sans divulgation progressive. |
| 9 | Récupération d'erreur | 2 | Erreur ancrée et honnête, mais sans icône, sans retry, sans route de sortie. |
| 10 | Aide et documentation | 3 | « Tout est facultatif » juste. La phrase envoyée au modèle n'est jamais montrée. |
| **Total** | | **24/40** | **Acceptable** |

## Verdict de spécificité

Autorisé aux bords, emprunté au milieu. `CookingFrom` et `GeneratingOverlay` (produits réels nommés, dates réelles) sont propres au produit. Les six groupes de chips sont l'ontologie standard des générateurs de recettes : aucune des 24 options ne sait que le garde-manger est partagé ni que les produits sont datés. `Portions` ne se défaut pas sur `household.members.length` (déjà lu dans settings). `Régime` est un fait de foyer posé comme question par requête. Les lignes de `CookingFrom` ne sont pas pressables — le seul contrôle qu'aucun concurrent ne peut offrir est absent.

Scan déterministe : `detect.mjs` exit 0, 0 finding. `tsc` passe. ESLint 0 erreur (1 warning pré-existant hors périmètre). Jest 30 suites / 156 tests verts. Deux littéraux couleur hors palette dans `recipe-detail-screen.tsx:157,164`. Tous les Pressable neufs ont role + label.

Overlays visuels : aucun (ni adb, ni xcrun, ni automatisation navigateur). Zéro pixel inspecté.

## Ce qui marche

1. Le chemin zéro-saisie a survécu à la feature : `composeRecipePrompt` renvoie `undefined` sur formulaire vierge.
2. `recipe-prompt.ts` : chaque `clause` envoyée au modèle est à trois caractères de son `label` visible.
3. `CookingFrom` rend une promesse vérifiable.

## Problèmes prioritaires

- **[P0] Génération réussie renvoyant `[]` ferme la feuille en silence** (`recipe-generate-screen.tsx:81-85`). Garder avant `router.back()`, afficher une erreur, déplacer `invalidateQueries` après le garde. → `/impeccable harden`
- **[P1] `no_products` est un cul-de-sac dans un modal** sans navigation. Router le `type` d'erreur, pilule d'action dans le chip, même action dans l'état vide de `CookingFrom`. → `/impeccable harden`
- **[P1] Registre de péremption accusateur et incohérent** — la branche de repli du dashboard dit déjà « À consommer en premier ». Idem `TriangleAlertIcon` sur « On part de ». → `/impeccable clarify`
- **[P1] Composer inutilisable au lecteur d'écran** : 24 boutons sans frontière de groupe ; overlay bloquant sans `accessibilityViewIsModal`. → `/impeccable audit`
- **[P2] `ScreenHeader` contourné (8e écran) et chip d'erreur couleur+mot sans icône.** → `/impeccable polish`

## Personas

- **Jordan (1re fois, garde-manger vide)** : trois écrans consécutifs nomment ce qui manque, aucun n'offre la porte.
- **Alex (foyer végétarien de 4)** : retape Végétarien + Pour 4 à chaque génération ; ne peut pas dire « utilise le yaourt » alors que le yaourt est affiché.
- **Sam (VoiceOver)** : 24 boutons anonymes ; passe à travers l'overlay ; sur le P0 rien n'est annoncé.

## Observations mineures

- Barre inférieure épinglée sans `maxWidth`/`alignSelf` : s'étire bord à bord sur desktop.
- `identity-card.tsx` garde `numberOfLines={1}` sur la valeur.
- L'ombre de `CookingFrom` est une 5e entrée de vocabulaire non documentée.
- `summarize()` compte les choix au lieu d'afficher la phrase composée.

## Questions

1. `CookingFrom` promet quatre produits, mais le serveur choisit ses propres ingrédients — supposition client présentée comme fait ?
2. Si « périmer » quitte la copie, la couleur `expired` (#C6493B, rouge d'alarme) reste-t-elle ?
3. Combien des six groupes survivent à onze secondes de patience et une main libre ?
