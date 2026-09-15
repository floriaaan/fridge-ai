# ADR-0012 — Journal des sorties produit plutôt que soft-delete

## Contexte

ADR-0010 avait repoussé les colonnes `consumedAt`/`discardedAt`/`discardReason` sur
`product` tant qu'aucun use-case ne les écrivait. Les statistiques de gaspillage
(`docs/roadmap-post-mvp.md`, chantier 1) en ont besoin : sans savoir si un produit a
été mangé ou jeté, il n'y a rien à compter.

Aujourd'hui un produit quitte le garde-manger par `DELETE` (détail, sélection multiple),
par une baisse de quantité via `PATCH` (« J'en ai consommé un »), ou par
`CookRecipe`. Aucun de ces chemins ne dit ce qu'est devenu le produit.

## Décision

**Une table append-only `product_outcome`**, une ligne par sortie, avec un instantané
du produit (nom, catégorie, emplacement, quantité sortie, prix au prorata, date de
péremption). La ligne `product` continue d'être supprimée ou décrémentée comme
avant ; l'écriture de la sortie et la mutation du stock se font dans une seule
transaction (`ProductRepository.recordOutcome`).

Rejeté — **soft-delete sur `product`** : chaque requête produit existante (liste,
péremption, dashboard, suggestions de recettes, recherche) devrait filtrer les produits
sortis, pour toujours, et un oubli fait réapparaître un produit fini dans le frigo du
foyer entier. Il ne sait pas non plus représenter une sortie partielle (2 yaourts jetés
sur 6) sans une seconde table. Le journal règle les deux, sur le même modèle que
`recipe_cook`.

**Sorties partielles tracées.** Chaque « J'en ai consommé un » est une ligne de 1 unité.
Le prix d'une ligne est `price × amount / initial_quantity` : `price` sur `product` est
le prix de la ligne de ticket, pour la quantité achetée. D'où la nouvelle colonne
`product.initial_quantity`, qui ne baisse jamais et monte si une correction de quantité
la dépasse.

**`product_outcome.product_id` sans clé étrangère.** Le produit disparaît le plus
souvent au moment même où la ligne est écrite ; l'identifiant sert seulement à
regrouper les sorties partielles d'un même produit.

**L'erreur de saisie n'est pas journalisée.** `DELETE /api/products/:id` reste
disponible pour les doublons de scan ou d'import, et n'écrit rien : une statistique qui
compte les erreurs de saisie comme du gaspillage est fausse.

## Conséquences

- Aucune requête produit existante ne change.
- Les stats liront uniquement `product_outcome`, sans jointure sur `product`.
- Le backfill de `initial_quantity = quantity` surestime la valeur des sorties
  partielles des produits déjà entamés avant la migration. Pas de reconstitution
  possible ; accepté.
- Corriger une quantité à la baisse via le formulaire laisse `initial_quantity` intact :
  les sorties suivantes de ce produit seront sous-évaluées. Accepté plutôt que de
  deviner si un `PATCH` est une correction ou une consommation.
- Annuler une sortie enregistrée n'est pas possible en v1.
- Supprimer un foyer supprime son journal (`ON DELETE CASCADE`) ; un membre qui quitte
  le foyer laisse ses sorties, `recorded_by` passe à `NULL`.
