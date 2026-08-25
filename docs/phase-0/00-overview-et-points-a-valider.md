# Phase 0 — Cadrage

Ce dossier contient les livrables de la Phase 0 : arborescence, modèle de domaine,
schéma de base, endpoints HTTP, et ADR. Aucun code n'a été écrit à ce stade.

Rewrite complet de `~/dev/fridge` ("Fridge Companion", dormant depuis 2026-01-26).
Concept gardé, implémentation refaite à zéro. Stack et process réutilisent au maximum
les patterns rodés de `~/dev/arr` (monorepo pnpm, AdonisJS + Lucid, Taskfile, Docker
Compose, CI GitHub Actions, better-auth + PocketID) plutôt que de réinventer.

## Scope MVP v1 (validé avec le propriétaire, 2026-08-25)

**Inclus :**
- Produits : CRUD + expiry tracking, localisation (frigo/congélateur/garde-manger)
- Code-barres + lookup OpenFoodFacts (prefill à la création d'un produit)
- Receipt-scan photo : extraction IA (vision) d'un ticket de caisse → import multi-produits
- Recettes : génération IA (à la demande + suggestions basées sur les produits proches
  de la péremption)
- Shopping-list : CRUD simple
- Foyer partagé (household) : plusieurs utilisateurs partagent un même frigo/liste/recettes
- Auth : PocketID SSO + email/password, méthodes découvrables dynamiquement par le front

**Nice-to-have post-MVP (non construit maintenant, mais l'architecture ne doit pas leur
fermer la porte — cf. point 6 ci-dessous) :**
- Fridge-scan photo (import multi-produits depuis une photo du frigo entier)
- Statistiques (gaspillage, catégories, évolution par période)
- Intégration Home Assistant / HACS (capteurs + todo)

## Stack

- Monorepo pnpm : `backend/` (AdonisJS 7 + Lucid + Postgres), `mobile/` (Expo + expo-router
  + TanStack Query + Tamagui)
- Clean architecture / DDD stricte : `src/{domain,application,infrastructure}` côté
  backend, `+presentation` côté mobile — mêmes conventions de nommage qu'`arr`
  (`*.entity.ts`, `*.vo.ts`, `*.aggregate.ts`, `*.use-case.ts`, `*.lucid.ts`,
  `*.repository.ts`, `*.mapper.ts`, `*.controller.ts`, `*.routes.ts`, `*.dto.ts`,
  `*.validator.ts`, `*.query.ts`, `*.mutation.ts`)
- Auth : better-auth (email/password + plugin `genericOAuth` pour PocketID), copié du
  câblage `arr` (`docs/adr/0005` et `docs/adr/0009` d'arr) — scopes OIDC explicites,
  `accountLinking.trustedProviders: ['pocketid']`, `requireLocalEmailVerified: false`
- Docker Compose + Taskfile pour la stack locale complète, CI GitHub Actions
  (lint + typecheck + tests + boundary lint via dependency-cruiser)
- Aucun appel direct depuis le mobile (ou d'ailleurs) vers une API externe
  (OpenFoodFacts, providers IA) — tout transite par le backend

## Écarts assumés par rapport à l'original `~/dev/fridge` — à valider

Ces points tranchent des ambiguïtés ou changent des choix de l'original. Réversibles
si tu préfères autre chose.

1. **Lucid + migrations, pas Drizzle.** L'original (Elysia) utilisait Drizzle. Le
   backend est maintenant AdonisJS ; Lucid est son ORM natif et c'est ce qu'`arr`
   utilise avec succès en DDD strict (repository + mapper au-dessus du modèle Lucid).
   → [ADR-0001](../adr/0001-orm-lucid-plutot-que-drizzle.md)

2. **Frigo partagé (household) dès v1**, un seul foyer par utilisateur (pas de
   multi-foyer, pas de switch). L'original était strictement mono-utilisateur. C'est
   la décision la plus structurante du cadrage — impacte le modèle de domaine en
   entier (tout est scopé par `householdId`, pas `userId`).
   → [ADR-0003](../adr/0003-household-agregat-un-seul-foyer-par-utilisateur.md)

3. **Pas de plugin `admin` better-auth.** `arr` l'utilise pour un rôle global
   d'administration de l'instance. fridge-ai n'a pas ce besoin — les rôles
   `owner`/`member` sont portés par `household_member`, pas par better-auth.
   → [ADR-0004](../adr/0004-identity-sans-plugin-admin.md)

4. **Extraction receipt-scan en un seul appel IA multimodal**, pas d'étape OCR séparée
   (l'original avait un `ocr.service.ts` distinct). Les modèles vision (Gemini,
   GPT-4o/GPT-5, Ollama+llava/qwen2-vl) font l'OCR et l'extraction structurée en un
   seul appel — une dépendance en moins.
   → [ADR-0006](../adr/0006-extraction-ia-multimodale-sans-ocr-separe.md)

5. **`recipe.source` perd la valeur `'community'`** de l'original (pas de partage de
   recettes inter-foyers en v1 — YAGNI, aucun use-case MVP ne l'exploite).

6. **Rien n'est pré-câblé en base pour fridge-scan / stats / HA.** Le propriétaire a
   choisi "nice-to-have post-MVP, anticipé" plutôt que "hors scope, non anticipé" —
   je l'interprète comme : les *frontières de modules* ne doivent pas bloquer leur
   ajout futur (fridge-scan réutilisera le même pattern de port que receipt-scan ;
   les stats pourront lire `product`/`receipt` existants sans migration destructive),
   mais je n'ajoute **pas** de colonnes ou tables inutilisées par le MVP (ex. pas de
   `consumedAt`/`discardedAt`/`discardReason` sur `product` comme dans l'original —
   aucun use-case v1 ne les lit ni les écrit, les ajouter maintenant serait du
   placeholder mort). Si tu voulais plutôt des colonnes pré-câblées dès maintenant,
   dis-le — c'est un vrai choix, pas une évidence.
   → [ADR-0010](../adr/0010-scope-post-mvp-non-precharge-en-base.md)

7. **Images servies via routes imbriquées authentifiées** (`GET /api/products/:id/image`,
   `GET /api/receipts/:id/image`), pas de dossier `public/` statique comme l'original
   ni de proxy signé façon `arr` (celui d'`arr` sert des posters *externes* publics —
   problème différent). Les photos de frigo/tickets sont potentiellement sensibles et
   scopées au foyer.
   → [ADR-0009](../adr/0009-images-servees-via-routes-authentifiees.md)

## Points explicitement laissés simples (YAGNI) — signalés, pas cachés

- Un seul owner par foyer, pas de transfert de propriété v1 : pour quitter un foyer
  en tant qu'owner il faut le supprimer (cascade). Un member peut quitter librement.
- Pas de permissions fines owner/member au-delà de la gestion des membres — les deux
  rôles ont les mêmes droits sur produits/liste/recettes.
- Provider IA changeable à chaud (sans redéploiement) via `PATCH /api/settings/ai`,
  restreint aux owners de foyer, mais réglage **instance-wide** — pas par foyer, pas
  par requête. `AI_PROVIDER` en env reste le défaut au tout premier boot.
  → [ADR-0007](../adr/0007-provider-ia-changeable-a-chaud.md)
- Pas de vérification d'email (aligné sur le pattern `accountLinking` d'`arr` — pas de
  flow d'email à maintenir en v1).

## Versions à vérifier avant Phase 1

Réutilise les versions déjà vérifiées par `arr` (2026-07-26) pour le socle commun :
`@adonisjs/core` 7.x, `@adonisjs/lucid` 22.x, `better-auth` 1.6.x, `kysely` 0.29.x,
`pg` 8.x, `@vinejs/vine` 4.x, `pnpm` 11.x, Node ≥ 24. À vérifier spécifiquement pour
fridge-ai (pas couvert par `arr`, qui n'a pas de mobile) : `expo` (SDK courant),
`expo-router`, `@tanstack/react-query` (version mobile), `tamagui`, le SDK IA retenu
par provider (`@google/genai`, `openai`, client HTTP Ollama), et le client
`expo-camera`/scanner code-barres.
