# ADR-0010 — Fridge-scan / statistiques / HA repoussés post-MVP, rien de pré-câblé en base

## Contexte

Le propriétaire a explicitement choisi "nice-to-have post-MVP, anticipé" plutôt que
"hors scope, non anticipé" pour trois fonctionnalités de l'original : fridge-scan
photo (import multi-produits), statistiques (gaspillage/catégories/évolution), et
l'intégration Home Assistant/HACS.

## Décision

Interprétation retenue de "anticipé" : les **frontières de modules** ne doivent pas
bloquer leur ajout futur, mais **aucune colonne ni table n'est ajoutée par avance**
pour ces fonctionnalités si aucun use-case MVP ne les utilise.

Concrètement :
- Fridge-scan réutilisera le même pattern de port que receipt-scan
  (`FridgeScanExtractionPort`, nouveau bounded context ou extension de `fridge/`) —
  aucun changement requis sur `Product`/`Receipt` existants pour l'accueillir.
- Les statistiques pourront être calculées à partir de `product`/`receipt` tels quels
  (prix, quantités, dates déjà présents) — pas besoin d'une table
  `statistics_snapshot` pré-créée ni de colonnes `consumedAt`/`discardedAt`/
  `discardReason` sur `product` comme dans l'original : aucun use-case v1 ne les lit
  ni les écrit, les ajouter maintenant serait du code mort en attente.
- L'intégration HA est un client HTTP consommant l'API existante depuis l'extérieur
  (comme l'original) — n'impacte pas le schéma du tout, juste de nouveaux endpoints
  ou un token d'API dédié le jour venu.

## Conséquences

- Pas de placeholder mort dans le schéma v1 (conforme à l'auto-review du cadrage :
  pas de colonnes non lues/non écrites).
- Ajouter ces fonctionnalités plus tard demandera des migrations additives normales
  (nouvelles tables/colonnes), pas de refonte du modèle existant.
- Si le propriétaire voulait en réalité des colonnes pré-câblées dès maintenant
  (ex. `discardedAt` pour ne rien perdre rétroactivement une fois les stats
  construites), c'est un choix différent et légitime — signalé explicitement dans
  `docs/phase-0/00-overview-et-points-a-valider.md`, à trancher avant la Phase 1.
