# Sortie des produits (consommé / jeté) — Design

**Statut :** implémenté (2026-09-13)

## Contexte

Premier chantier de `docs/roadmap-post-mvp.md`. Les statistiques de gaspillage exigent
de savoir comment un produit a quitté le garde-manger ; aujourd'hui l'app ne le sait
jamais. Toutes les sorties passent par une suppression ou une baisse de quantité
indifférenciées :

| Point d'entrée | Mécanisme actuel |
| --- | --- |
| Détail produit — « J'en ai consommé un » | `PATCH /api/products/:id` avec `quantity - 1` |
| Détail produit — « J'ai fini ce produit » | sheet de confirmation puis `DELETE /api/products/:id` |
| Détail produit — « Retirer du garde-manger » | même sheet, même `DELETE` |
| Liste — sélection multiple « Retirer N produits » | `DELETE` séquentiels |
| Recette — « J'ai cuisiné » | `CookRecipe` appelle `products.delete()` par produit |

ADR-0010 avait volontairement reporté les colonnes `consumedAt`/`discardedAt`/
`discardReason` « au jour où un use-case les lit ». Ce chantier crée le use-case qui les
écrit ; l'écran de statistiques qui les lit fera l'objet d'un spec séparé, une fois des
données réelles accumulées.

### Décisions prises en amont (2026-09-13)

1. **Table journal**, pas de soft-delete : chaque sortie écrit une ligne dans
   `product_outcome` avec un instantané du produit. La ligne `product` continue d'être
   supprimée (ou décrémentée) comme aujourd'hui — aucune requête produit existante ne
   change (liste, péremption, recettes, dashboard).
2. **Sorties partielles tracées** : chaque « J'en ai consommé un » est une ligne de
   1 unité. Le prix est réparti au prorata, ce qui exige `initial_quantity` sur
   `product`.
3. **Raison de mise au rebut optionnelle**, liste courte : dépassé / abîmé / pas aimé /
   autre. « Dépassé » est pré-sélectionné quand la date est passée.
4. **Suppression « erreur de saisie » conservée**, non tracée : c'est l'actuel
   `DELETE /api/products/:id`, rendu visuellement secondaire.

## 1. Domaine — contexte borné `fridge`

Pas de nouveau contexte borné : une sortie est un événement sur un produit, et
`CookRecipe` dépend déjà de `ProductRepository`.

### `OutcomeKind` (VO)

`'consumed' | 'discarded'`. L'erreur de saisie n'est pas un `OutcomeKind` : elle
n'écrit rien.

### `DiscardReason` (VO)

`'expired' | 'spoiled' | 'disliked' | 'other'`. Valide seulement avec
`kind = 'discarded'` ; fourni avec `consumed`, c'est une erreur de validation.

### `ProductOutcome` (entité, append-only)

```ts
interface ProductOutcomeProps {
  householdId: string
  productId: string          // pas de FK : la ligne product disparaît souvent
  recordedBy: string         // user id
  recipeId: string | null    // renseigné quand la sortie vient de CookRecipe
  kind: OutcomeKind
  discardReason: DiscardReason | null
  // Instantané du produit au moment de la sortie
  productName: string
  category: string
  categories: string[] | null
  location: Location
  quantity: Quantity         // la part sortie, pas le stock restant
  price: number | null       // prorata, cf. ci-dessous
  expiresAt: Date | null
  occurredAt: Date
}
```

Pas de méthode de mutation : une sortie enregistrée est un fait. Corriger une erreur
(« en fait je ne l'ai pas jeté ») est hors scope v1.

### `Product` — changements

- Nouvelle prop `initialQuantity: number` : la plus grande quantité connue du produit.
  `create()` l'initialise à `quantity.amount`. `update()` la relève si une nouvelle
  quantité la dépasse (correction à la hausse) et ne la baisse jamais.
- Nouvelle méthode `takeOut(amount: number, at: Date): Result<{ remaining: Product | null; price: number | null }, ValidationError>` :
  - `amount` entier, `1 ≤ amount ≤ quantity.amount`, sinon erreur `quantity`.
  - `amount === quantity.amount` ⇒ `remaining = null` (le produit quitte le garde-manger).
  - sinon la quantité est décrémentée, `updatedAt = at`, `remaining = this`.
  - `price = price × amount / initialQuantity`, arrondi au centime ; `null` si le
    produit n'a pas de prix.

**Limite assumée du prorata :** `price` sur `product` est le prix de la ligne de ticket,
pour la quantité achetée. Si quelqu'un corrige la quantité à la baisse via le formulaire
(il pensait en avoir 6, il en a 4), `initialQuantity` reste à 6 et les sorties
sous-estiment la valeur. Accepté : l'alternative (deviner si un `PATCH` est une
correction ou une consommation) est exactement l'ambiguïté que ce chantier supprime.

## 2. Application

### `RecordProductOutcome` (nouveau use-case)

```ts
interface RecordProductOutcomeInput {
  householdId: string
  userId: string
  productId: string
  kind: 'consumed' | 'discarded'
  amount?: number            // défaut : toute la quantité restante
  discardReason?: string | null
}

type RecordProductOutcomeError = 'product_not_found' | ValidationError

// Result<{ product: Product | null; outcome: ProductOutcome }, RecordProductOutcomeError>
```

1. Charge le produit ; absent ou autre foyer ⇒ `product_not_found`.
2. Valide `kind` et `discardReason` (VOs), `product.takeOut(amount ?? quantity, clock.now())`.
3. Construit le `ProductOutcome` (instantané pris **avant** la décrémentation).
4. `products.recordOutcome(outcome, remaining)` — atomique.

### `CookRecipe` — changement

La boucle remplace `products.delete(product.id)` par la même séquence : `takeOut` de toute
la quantité, `ProductOutcome` `consumed` avec `recipeId`, `recordOutcome`. Le
comportement visible reste identique (le produit disparaît), le compteur
`productsUsed` aussi. Pas de transaction englobant tous les produits et le
`recordCook` — même tolérance qu'aujourd'hui : un produit périmé entre-temps est ignoré.

Pour éviter de dupliquer la construction de l'instantané, elle vit dans une fabrique
de domaine `ProductOutcome.fromProduct(product, { id, kind, discardReason, recordedBy, recipeId, takeOut, at })`
utilisée par les deux use-cases — `takeOut` est le résultat de `Product.takeOut()`, qui
porte la quantité sortie et le prix au prorata.

### `DeleteProduct` — inchangé

Il devient explicitement la correction « erreur de saisie ». Un commentaire le dit,
pour qu'un futur contributeur ne le « corrige » pas en y ajoutant un journal.

### `UpdateProduct` — inchangé côté API

Seule conséquence : relever `initialQuantity` via `Product.update()`. Le mobile cesse
de l'utiliser pour « J'en ai consommé un ».

## 3. Infrastructure

### `ProductRepository` — nouvelle méthode

```ts
/**
 * Écrit la sortie et applique son effet sur le stock dans une seule transaction :
 * `remaining === null` supprime le produit, sinon il est sauvegardé.
 */
recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void>
```

Implémentation Lucid avec `db.transaction`, même forme que
`household.repository.ts`/`recipe.repository.ts`. Nouveau `ProductOutcomeModel`
(`product-outcome.lucid.ts`) et mapper.

`save()` et le mapper `product` gèrent `initial_quantity`.

## 4. Schéma base de données

### `1785200000014_add_initial_quantity_to_product_table`

```ts
table.integer('initial_quantity').nullable()
// backfill
UPDATE product SET initial_quantity = quantity
table.integer('initial_quantity').notNullable().alter()
```

Backfill honnête mais imparfait : les produits déjà entamés avant la migration ont
`initial_quantity = quantity` restante, donc leurs sorties partielles seront
surévaluées. Aucun moyen de reconstituer l'historique ; volume négligeable.

### `1785200000015_create_product_outcome_table`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `household_id` | text not null | FK `household` `ON DELETE CASCADE` |
| `product_id` | text not null | **pas de FK** — regroupe les sorties partielles d'un même produit après sa suppression |
| `recorded_by` | text null | FK `user` `ON DELETE SET NULL` — le membre peut quitter le foyer, le fait reste |
| `recipe_id` | text null | FK `recipe` `ON DELETE SET NULL` |
| `kind` | text not null | `CHECK IN ('consumed', 'discarded')` |
| `discard_reason` | text null | `CHECK IN ('expired', 'spoiled', 'disliked', 'other')` |
| `product_name` | text not null | |
| `category` | text not null | |
| `categories` | text[] null | |
| `location` | text not null | `CHECK IN ('fridge', 'freezer', 'pantry')` |
| `amount` | integer not null | `CHECK (amount > 0)` |
| `unit` | text not null | |
| `price` | decimal(10,2) null | prorata |
| `expires_at` | timestamptz null | |
| `occurred_at` | timestamptz not null | défaut `now()` |

Contrainte : `CHECK (discard_reason IS NULL OR kind = 'discarded')`.
Index : `(household_id, occurred_at)` pour les futures requêtes par période,
`product_id`.

« Jeté alors que dépassé » n'est pas stocké : c'est `expires_at < occurred_at`, calculable.

## 5. API HTTP

### `POST /api/products/:id/outcomes`

Corps :

```json
{ "kind": "discarded", "amount": 2, "discardReason": "spoiled" }
```

- `kind` requis ; `amount` entier positif optionnel ; `discardReason` optionnel, nullable.
- `200` : `{ "product": ProductDto | null, "outcome": ProductOutcomeDto }` —
  `product: null` quand le produit a quitté le garde-manger.
- `404 product_not_found` (absent ou autre foyer) ; `400 validation_failed`
  (`amount` > stock, raison avec `consumed`, valeurs hors liste).
- Trace : `traceAction(ctx, 'fridge', RecordProductOutcome, …, { action: 'fridge.record_product_outcome' })`.

`ProductOutcomeDto` reprend les colonnes en camelCase, dates ISO.

Pas d'endpoint de lecture des sorties dans ce chantier : aucun écran ne les lit encore.
Pas d'endpoint groupé non plus : la sélection multiple reste en appels séquentiels,
comme `handleRemoveSelected` aujourd'hui.

`DELETE /api/products/:id` et `POST /api/recipes/:id/cooked` : contrat inchangé.

Mettre à jour `docs/phase-0/04-endpoints-http.md`.

## 6. Mobile

### Domaine et plomberie

- `domain/fridge/product-outcome.ts` : types `OutcomeKind`, `DiscardReason`,
  `RecordProductOutcomeInput`, `ProductOutcome` (miroir du DTO).
- `FridgeConnector.recordProductOutcome(productId, input): Promise<Result<{ product: Product | null; outcome: ProductOutcome }, ApiError>>`.
- `HttpFridgeConnector` : `apiFetch` avec `action: 'fridge.record_product_outcome'`,
  `attributes: { 'entity.id': productId }`.
- `FakeFridgeConnector` : décrémente ou retire le produit, garde les sorties dans un
  tableau interne (exposé pour les tests).
- `application/fridge/record-product-outcome.mutation.ts` : invalide `['products']` et
  `['product', productId]`.

### Détail produit (`fridge-detail-screen.tsx`)

- **Bouton principal** « J'en ai consommé un » / « J'ai fini ce produit » :
  `recordProductOutcome({ kind: 'consumed', amount: 1 })`. Plus de sheet de
  confirmation pour la dernière unité — consommer est l'action attendue, pas une
  destruction. Dernière unité ⇒ retour à la liste avec le hint « Produit terminé ».
- **Bouton secondaire** « Retirer du garde-manger » ouvre un `ActionSheet`
  « Que devient ce produit ? » :
  - « Consommé » — toute la quantité restante.
  - « Jeté » — ouvre la seconde étape (ci-dessous).
  - « Supprimer — erreur de saisie » — option visuellement secondaire, `DELETE` actuel,
    description « Ne compte pas dans les statistiques ».
- **Étape « Jeté »** : raisons en chips (Dépassé, Abîmé, Pas aimé, Autre), aucune
  requise, « Dépassé » pré-sélectionné si `isExpired(product)`. Si
  `quantity.amount > 1`, stepper de quantité, défaut = tout le stock restant.
  Bouton « Jeter ».

### Liste — sélection multiple (`fridge-list-screen.tsx`)

`SelectionBar` « Retirer » ouvre le même `ActionSheet` au pluriel : « Consommés »,
« Jetés » (une raison commune, « Dépassé » pré-sélectionné si tous les produits
sélectionnés sont dépassés, pas de stepper — toute la quantité de chacun),
« Supprimer — erreurs de saisie ». Appels séquentiels et message d'échec partiel
conservés.

### Recettes

Aucun changement : `cookRecipe` garde son contrat.

### Copie

La description actuelle « C'est définitif, et ils disparaissent aussi du garde-manger des
autres membres du foyer » reste sur l'option « erreur de saisie ». Les options
Consommé/Jeté disent ce qu'elles font sans ton d'alerte.

Les écrans modifiés passent une revue `impeccable` avant merge (composant sheet en deux
étapes, hiérarchie de l'option « erreur »).

## 7. Tests

**Backend**

- Unitaire domaine : `DiscardReason`/`OutcomeKind`, `Product.takeOut` (partiel, total,
  hors bornes, prorata avec et sans prix, arrondi), relèvement de `initialQuantity` dans
  `update()`, `ProductOutcome.fromProduct` (instantané avant décrémentation).
- Infrastructure : `recordOutcome` — sortie totale supprime le produit et insère la
  ligne ; partielle décrémente et insère ; rollback si l'insertion échoue (produit
  intact).
- Fonctionnel : `POST /api/products/:id/outcomes` — 200 total/partiel, 404 autre foyer,
  400 `amount` > stock, 400 raison avec `consumed` ; `POST /api/recipes/:id/cooked` écrit
  une ligne `consumed` avec `recipe_id` par produit consommé ; `DELETE` n'écrit rien.
- Migration : backfill `initial_quantity` sur un produit existant.

**Mobile**

- `FakeFridgeConnector.recordProductOutcome` (partiel, total, produit absent).
- Détail : consommer une unité, finir le produit (retour liste), flux Jeté avec raison
  pré-sélectionnée sur produit dépassé, option erreur de saisie appelle `deleteProduct`.
- Liste : sélection multiple ⇒ Jetés ⇒ N appels `recordProductOutcome`, échec partiel.

## 8. ADR à écrire

**ADR-0012 — Journal des sorties produit plutôt que soft-delete.** Complète ADR-0010 :
pourquoi une table append-only avec instantané (aucune requête produit à filtrer,
survit à la suppression du produit, même logique que `recipe_cook`), pourquoi
`initial_quantity`, pourquoi l'erreur de saisie n'est pas journalisée.

## Hors scope

- Écran de statistiques et endpoint de lecture des sorties (spec suivant).
- Annuler ou corriger une sortie enregistrée.
- Détection automatique des produits dépassés jamais retirés (proposer « Jeté ? » depuis
  le dashboard) — bonne suite, mais c'est une décision UX à part.
- Reprise de l'historique antérieur à la migration.
- Sorties partielles depuis la sélection multiple.
