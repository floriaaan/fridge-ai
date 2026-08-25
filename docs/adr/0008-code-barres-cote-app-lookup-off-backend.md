# ADR-0008 — Décodage code-barres côté app, lookup OpenFoodFacts uniquement backend

## Contexte

La règle dure du workflow interdit tout appel direct depuis le mobile vers une API
externe. Le décodage d'un code-barres à partir d'une image de caméra est une
opération de vision *locale* (lib caméra Expo), pas un appel réseau — mais le lookup
du produit correspondant sur OpenFoodFacts *est* un appel externe.

## Décision

- Décodage du code-barres : entièrement côté app (`expo-camera` / scanner intégré),
  aucune image envoyée au backend pour cette étape.
- L'app envoie uniquement la valeur du code (`GET /api/products/lookup?barcode=...`)
  au backend, qui appelle OpenFoodFacts server-side via `ProductLookupPort`.

## Conséquences

- Respecte la règle dure sans sacrifier la latence (pas d'aller-retour image pour un
  simple décodage local).
- Le backend reste le seul point de sortie réseau externe pour OpenFoodFacts — audit
  et rate-limiting centralisés si besoin plus tard.
