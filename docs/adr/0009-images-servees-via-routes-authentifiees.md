# ADR-0009 — Images servies via routes imbriquées authentifiées

## Contexte

L'original servait les images de produits depuis un dossier `public/images/` statique
— accessible sans auth à quiconque devine l'URL. `arr` a un système de proxy d'images
signé (`image-proxy.controller.ts` + `image-ref-signer.ts`), mais celui-ci sert des
posters *externes publics* (affiches de films/séries) — problème différent : là-bas
il s'agit de cacher/proxy des URLs externes, pas de restreindre l'accès à des fichiers
privés. Les photos de fridge-ai (tickets de caisse, produits) appartiennent à un foyer
précis et peuvent être sensibles (ticket de caisse = montants, parfois adresse du
magasin).

## Décision

Pas de dossier `public/` statique pour les images utilisateur. Chaque image est
accessible via une route imbriquée dans sa ressource propriétaire :
`GET /api/receipts/:id/image`, `GET /api/products/:id/image`. Le controller vérifie
que la ressource appartient au foyer du caller (même garde que les autres endpoints
de la ressource) avant de streamer le fichier depuis le disque via `StorageService`.

## Conséquences

- Pas de clé/URL devinable donnant accès à l'image d'un autre foyer — l'autorisation
  suit exactement celle de la ressource parente, pas de logique séparée à maintenir.
- Coût : chaque affichage d'image passe par le backend (pas de CDN/URL publique
  cacheable par le navigateur) — acceptable à l'échelle d'un usage familial
  self-hosted, à revisiter si jamais le volume d'images devient un problème de perf.
- `imageKey` stocké en base est une clé de stockage opaque, jamais une URL — le
  chemin de fichier réel reste un détail de `StorageService`, swappable vers S3/minio
  sans toucher au domaine ni aux endpoints.
