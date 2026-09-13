# Statistiques de gaspillage — Design

**Statut :** approuvé (2026-09-14)

## Contexte

Suite du chantier 1 de `docs/roadmap-post-mvp.md` : le journal `product_outcome`
(ADR-0012) écrit depuis le 2026-09-13. Ce document couvre l'écran qui le lit.

### Décisions prises en amont (2026-09-14)

1. **Emplacement :** écran `stack` (comme Réglages/Foyer/Historique des tickets),
   pas un 5e onglet — atteint depuis l'accueil par un bouton icône, au même
   endroit que celui de Réglages.
2. **Scope v1 :** € et nombre de produits jetés sur la période, évolution
   jeté/consommé par sous-période (graphique), part des sorties « consommé »
   liées à une recette. Pas de classement par catégorie (reporté).
3. **Période :** sélecteur 7 jours / 30 jours / tout, 30 jours par défaut.

## 1. Forme des données (choix de visualisation)

- **€ jetés** et **produits jetés** sur la période → deux `StatCard` (déjà
  utilisées sur le dashboard) : une poignée de chiffres-titres, pas un graphique.
- **Évolution jeté/consommé** → un **nombre de sous-périodes fixe (6)**, pas un
  bucket par jour/semaine : la largeur d'écran ne change pas avec la période
  choisie, et « tout » n'a pas besoin d'une règle jour/semaine séparée. Chaque
  sous-période porte deux barres (comptage jeté / comptage consommé), jamais le
  €uro et le comptage sur le même graphique (deux échelles → deux widgets, pas
  un axe double).
- **Part sauvée par les recettes** → un **meter** (ratio simple contre 100 %,
  pas un camembert à deux parts) : part des sorties « consommé » qui portent un
  `recipeId` non nul, sur la période.
- Comptage, pas valeur, pour le graphique : le comptage se compare visuellement
  d'un coup d'œil, le prix mélange des unités.

**Couleurs :** réemploi de `expiredText`/`expiredBg` (jeté) et `freshText`/`freshBg`
(consommé) — pas une palette catégorielle générique. Ce n'est pas un abus de
tokens de statut pour « série 4 » : jeté et consommé *sont* littéralement les
concepts que ces tokens représentent déjà (perte vs bon état) ailleurs dans l'app.
Légende avec pastille + libellé (obligatoire à partir de 2 séries).

**Pas de nouvelle dépendance graphique.** Deux barres par sous-période, hauteur
proportionnelle au max de la période — des `View`/`YStack` Tamagui suffisent,
pas de SVG. Barres ≤ 24px, coin arrondi 4px en haut, écart de 2px entre les deux
barres d'une même sous-période.

## 2. Backend

### Nouveau port `ProductOutcomeStatsPort`

`backend/src/domain/fridge/interfaces/product-outcome-stats.interface.ts` :

```ts
export interface OutcomeBucket {
  from: Date
  to: Date
  discardedCount: number
  consumedCount: number
}

export interface ProductOutcomeStats {
  from: Date
  to: Date
  discarded: { count: number; value: number }
  consumed: { count: number; value: number }
  /** 0 quand consumed.count === 0 — pas de division par zéro. */
  recipeSharePercent: number
  /** Toujours 6 éléments, plus ancien en premier, même quand une sous-période est vide. */
  buckets: OutcomeBucket[]
}

export interface ProductOutcomeStatsPort {
  getStats(householdId: string, from: Date, to: Date, bucketCount: number): Promise<ProductOutcomeStats>
}
```

Port séparé de `ProductRepository` (pas de méthode de plus sur l'agrégat
`Product`) : c'est un modèle de lecture agrégé sur `product_outcome`, sans
rapport avec les invariants de `Product`. Implémentation Lucid en SQL brut
(même style que `cookStatsFor` dans `recipe.repository.ts`) — une requête
groupée par sous-période plutôt que N+1.

`from` : `now() - days` si `days` fourni, sinon la date du plus ancien
`product_outcome` du foyer (ou `now()` si le foyer n'a encore aucune sortie —
bornes égales, tous les buckets à zéro).

### Use-case `GetProductOutcomeStats`

```ts
export interface GetProductOutcomeStatsInput {
  householdId: string
  /** Absent = "tout" depuis la première sortie du foyer. */
  days?: number
}
```

Pas de `Result` : aucun échec métier, seules des erreurs d'infra qui remontent
normalement.

### Endpoint

`GET /api/products/outcomes/stats?days=30`

- `days` optionnel, entier positif (validé par VineJS — hors-liste ⇒ 422 comme
  partout ailleurs dans l'API, cf. `docs/adr/...` sur la convention 400/422
  établie au chantier précédent).
- `200 { stats: ProductOutcomeStatsDto }`, dates en ISO.

Enregistrer sous `docs/phase-0/04-endpoints-http.md`.

## 3. Mobile

### Domaine et plomberie

- `domain/fridge/product-outcome-stats.ts` : types miroir du DTO.
- `FridgeConnector.getProductOutcomeStats(days?: number): Promise<ProductOutcomeStats>`
  — pas de `Result` côté fake/HTTP non plus (lecture, pas de cas d'erreur
  métier ; une erreur réseau reste une exception `apiFetch` classique comme les
  autres `get*` du connector qui ne sont pas des mutations).
- `application/fridge/product-outcome-stats.query.ts` : `useProductOutcomeStatsQuery(days?)`.
- `FakeFridgeConnector` : calcule les stats à partir de son tableau interne
  `outcomes` (déjà là depuis le chantier 1) — aucune nouvelle fixture requise,
  mais un jeu de données de démo minimal pour que l'écran ne s'ouvre pas
  toujours vide en mode fake (quelques sorties `discarded`/`consumed` datées
  dans les fixtures).

### Écran `StatsScreen` (`presentation/fridge/stats-screen.tsx`)

- Route `src/app/stats.tsx`, `kind: 'stack'`, en-tête `ScreenHeader` (icône
  `TrendingUpIcon`, titre « Statistiques »), bouton retour standard.
- Sélecteur de période : trois `Chip` (7 j / 30 j / Tout), un seul sélectionné,
  state local — remonte `days` à la query.
- Deux `StatCard` côte à côte (€ jetés, produits jetés).
- `WasteTrendChart` : les 6 barres doubles + légende.
- `RecipeShareMeter` : un composant `Meter` neuf (`presentation/shared/meter.tsx`)
  réutilisable — remplissage `accentLime`/`freshText`, piste = pas de couleur
  du même ramp.
- États : squelette pendant le chargement, message d'erreur + retry si la
  requête échoue (même pattern que `CabinetError`), état vide explicite si
  `discarded.count === 0 && consumed.count === 0` sur la période (« Rien à
  montrer sur cette période » plutôt que des graphiques à zéro).

### Point d'entrée

Bouton icône 44×44 sur le dashboard, juste avant celui de Réglages (même
composant `Pressable` que `open-settings`), `TrendingUpIcon`,
`accessibilityLabel="Statistiques"`, `testID="open-stats"`.

## 4. Tests

**Backend** : port fake + use-case (bornes de période, part recette à 0 sans
consommation, buckets vides quand aucune sortie) ; implémentation Lucid
(agrégation SQL correcte sur un jeu de sorties connu) ; fonctionnel sur
l'endpoint (200, formes des dates, `days` invalide → 422).

**Mobile** : query avec `FakeFridgeConnector` ; `WasteTrendChart`/`Meter` en
isolation (rendu des barres/du remplissage selon les props, pas de division
par zéro) ; écran (chargement, données, période changée relance la requête,
état vide, erreur+retry).

## Hors scope

- Classement par catégorie.
- Export/partage des stats.
- Comparaison à la période précédente (delta).
- Stats par membre du foyer (le foyer reste l'unité, comme partout ailleurs).
