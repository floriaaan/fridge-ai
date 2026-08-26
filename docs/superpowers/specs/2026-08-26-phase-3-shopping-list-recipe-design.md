# Phase 3 — Shopping-list + Recipe : Design

**Statut:** approuvé (2026-08-26)

## Contexte

Complète le MVP v1 (cf. [`docs/phase-0/00-overview-et-points-a-valider.md`](../../phase-0/00-overview-et-points-a-valider.md)) : les 2 derniers bounded contexts restants après phase 1 (identity/household) et phase 2 (fridge/receipt/settings) — **shopping-list** et **recipe**.

Le modèle de domaine, le schéma DB et les endpoints HTTP sont **déjà entièrement spécifiés** en phase 0 :
- [`docs/phase-0/02-modele-de-domaine.md`](../../phase-0/02-modele-de-domaine.md) — sections `shopping-list` et `recipe`
- [`docs/phase-0/03-schema-base-de-donnees.md`](../../phase-0/03-schema-base-de-donnees.md) — tables `shopping_item`, `recipe`, `recipe_ingredient`
- [`docs/phase-0/04-endpoints-http.md`](../../phase-0/04-endpoints-http.md) — sections `shopping-list` et `recipe`

Ce document ne redéfinit pas ces décisions déjà prises ; il couvre uniquement ce que phase 0 ne tranche pas : l'organisation des fichiers, l'intégration au `ai-provider-registry` existant, un écart de scope assumé, et la stratégie de test.

## 1. Bounded contexts et ordre de build

Deux contextes indépendants entre eux (`recipe.RecipeIngredient.productId` est une FK optionnelle vers `fridge.Product`, jamais un appel de méthode). Build dans l'ordre :

1. `shopping-list` — pas de dépendance IA, CRUD simple, livre vite un incrément testable.
2. `recipe` — dépend du même mécanisme `ai-provider-registry` que `receipt` (phase 2), lit les `Product` du foyer courant pour construire son contexte de génération.

## 2. Organisation des fichiers

Suit exactement les conventions posées en phase 2 (`*.entity.ts`, `*.vo.ts`, `*.aggregate.ts`, `*.lucid.ts`, `*.mapper.ts`, `*.repository.ts`, `*.use-case.ts`, `*.dto.ts`, `*.validator.ts`, `*.controller.ts`, `*.routes.ts`).

```
backend/src/domain/shopping-list/
  shopping-item.entity.ts
  shopping-item-source.vo.ts        # 'manual' | 'auto_expired' | 'recipe'
  interfaces/shopping-item-repository.interface.ts
  # réutilise domain/fridge/quantity.vo.ts (même VO Quantity { amount, unit })

backend/src/domain/recipe/
  recipe.aggregate.ts               # AggregateRoot — racine, porte ingredients[]
  recipe-ingredient.entity.ts       # interne à l'agrégat
  recipe-source.vo.ts               # 'ai' | 'user'
  recipe-draft.ts                   # VO jamais persisté, résultat brut de génération IA
  interfaces/recipe-repository.interface.ts
  interfaces/recipe-generation-port.interface.ts

backend/src/infrastructure/database/shopping-list/
  shopping-item.lucid.ts
  shopping-item.mapper.ts
  shopping-item.repository.ts

backend/src/infrastructure/database/recipe/
  recipe.lucid.ts
  recipe-ingredient.lucid.ts
  recipe.mapper.ts                  # mappe l'agrégat + ses ingredients en une transaction
  recipe.repository.ts

backend/src/infrastructure/settings/
  gemini-recipe-generation.adapter.ts
  openai-recipe-generation.adapter.ts
  ollama-recipe-generation.adapter.ts
  # ai-provider-registry.ts (existant, modifié) : + resolveRecipeGenerationAdapter,
  # + __setRecipeGenerationOverrideForTests

backend/src/application/shopping-list/
  create-shopping-item.use-case.ts
  list-shopping-items.use-case.ts
  update-shopping-item.use-case.ts  # toggle checked + édition name/quantity
  delete-shopping-item.use-case.ts

backend/src/application/recipe/
  generate-recipes.use-case.ts      # persiste (POST /api/recipes/generate)
  suggest-recipes.use-case.ts       # ne persiste pas (GET /api/recipes/suggestions)
  save-recipe.use-case.ts           # POST /api/recipes (suggestion confirmée ou recette manuelle)
  list-recipes.use-case.ts
  show-recipe.use-case.ts
  delete-recipe.use-case.ts

backend/src/presentation/shopping-list/
  shopping-item.dto.ts
  shopping-item.validator.ts
  shopping-item.controller.ts
  shopping-item.routes.ts

backend/src/presentation/recipe/
  recipe.dto.ts
  recipe.validator.ts
  recipe.controller.ts
  recipe.routes.ts

backend/database/migrations/
  <timestamp>_create_shopping_item_table.ts
  <timestamp>_create_recipe_table.ts
  <timestamp>_create_recipe_ingredient_table.ts

backend/providers/
  shopping_list_provider.ts
  recipe_provider.ts

backend/bruno/shopping-list/*.bru
backend/bruno/recipe/*.bru
```

## 3. Intégration IA — `RecipeGenerationPort`

Même mécanisme que `ReceiptExtractionPort` (phase 2) : `ai-provider-registry.ts` résout l'adapter actif via `AiSettingsProvider.resolveEffective()`, avec cache invalidé sur changement de signature (provider actif ou credentials env). Aucune nouvelle infra de settings — `AiProviderSettings` reste partagé entre les deux ports.

```ts
interface RecipeGenerationPort {
  generate(context: RecipeGenerationContext): Promise<RecipeDraft[]>
}

interface RecipeGenerationContext {
  products: Array<{ name: string; category: string; expiresAt: Date | null }>
  prompt?: string
  prioritizeExpiringSoon: boolean
}
```

Contrat de sortie identique aux deux use-cases (`generate`, `suggestions`) — seul le `context` diffère (`prompt`/`prioritizeExpiringSoon`) et seul `generate-recipes.use-case.ts` persiste le résultat (`RecipeRepository.save`).

## 4. Écart de scope assumé — triggers automatiques du `ShoppingItemSource`

Phase 0 définit `ShoppingItemSource = 'manual' | 'auto_expired' | 'recipe'` mais ne spécifie, dans `04-endpoints-http.md`, aucun endpoint ni mécanisme qui *produit* automatiquement un item `auto_expired` (ex. job planifié sur produits expirés) ou `recipe` (ex. ajout auto des ingrédients manquants d'une recette générée).

**Ruling (cohérent avec [ADR-0010](../../adr/0010-scope-post-mvp-non-precharge-en-base.md), qui pose déjà la même limite pour fridge-scan/stats/HA) :** v1 accepte `source` comme un champ fourni par le client sur `POST /api/shopping-items`, validé contre l'enum, sans aucune génération automatique. Rien n'empêche un ajout futur (event domain `ProductExpired` → job → `auto_expired`, ou un endpoint dédié `POST /api/recipes/:id/add-missing-ingredients`) — mais ce n'est pas construit maintenant, pas de placeholder mort.

## 5. Enveloppe d'erreur et sécurité

Aucun changement au contrat existant ([`error-serializer.ts`](../../../backend/src/presentation/shared/error-serializer.ts), `household_required_middleware`). Toutes les routes des deux contextes exigent session + foyer (`401`/`403` déjà couverts par le middleware existant). Pas de nouveau champ sensible, pas de nouvel upload (`recipe.imageKey` existe dans le modèle mais aucun endpoint v1 ne l'écrit — cohérent avec le point 6 de phase 0 : colonne présente pour ne pas fermer la porte à une génération d'image IA future, jamais lue/écrite par un use-case v1).

## 6. Stratégie de test

Mêmes conventions que phase 2 :
- Tests fonctionnels japa par endpoint, `group.each.setup(() => db.beginGlobalTransaction())` / rollback en teardown.
- Helper `signUpWithHousehold` dupliqué par fichier de test (pattern déjà établi, pas d'abstraction partagée inter-fichiers de test).
- `__setRecipeGenerationOverrideForTests(fakePort)` pour isoler `generate`/`suggestions` de tout appel IA réel, symétrique à `__setReceiptExtractionOverrideForTests`.
- Cas à couvrir : CRUD shopping-item + validation quantité (réutilise les règles de `Quantity`) ; génération recipe (persiste, ingredients liés), suggestions (ne persiste pas), save d'une suggestion, delete, 403 sans foyer, 422 schéma invalide.

## 7. Séquencement des tâches (pour le plan d'implémentation)

1. Migrations (`shopping_item`, `recipe`, `recipe_ingredient`)
2. Domain `shopping-list` (entity, VO, port)
3. Infra + application + présentation `shopping-list` (un seul incrément CRUD)
4. Domain `recipe` (aggregate, entity interne, VOs, ports)
5. Adapters IA `*-recipe-generation.adapter.ts` + extension `ai-provider-registry.ts`
6. Infra database `recipe` (repository + mapper, gère l'agrégat + ses ingredients)
7. Application + présentation `recipe` (5 use-cases, 1 controller)
8. Bruno collection (`shopping-list/`, `recipe/`)
