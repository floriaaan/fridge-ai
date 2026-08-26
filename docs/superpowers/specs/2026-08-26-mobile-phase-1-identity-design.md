# Mobile Phase 1 — Squelette + identity : Design

**Statut:** approuvé (2026-08-26)

## Contexte

Premier incrément du package `mobile/` (Expo + expo-router + TanStack Query + Tamagui), jusqu'ici jamais commencé. Le backend couvre déjà tout le scope MVP v1 (identity/household, fridge/receipt/settings, shopping-list/recipe — phases 1 à 3, mergées sur `main`).

L'arborescence complète du mobile est déjà spécifiée en phase 0 :
[`docs/phase-0/01-arborescence.md`](../../phase-0/01-arborescence.md) (section `mobile/`). Ce document ne redéfinit pas cette arborescence ; il découpe le premier incrément à en construire et tranche ce que phase 0 laisse ouvert (gestion de session côté RN, PocketID mobile, testing).

Comme pour le backend, le mobile se construit par incréments alignés sur les bounded contexts déjà backés :

1. **Mobile Phase 1 (ce document)** — squelette applicatif + identity minimal (sign-in/sign-up, session-gated routing). Pas d'onboarding household, pas d'écrans métier.
2. Mobile Phase 2+ (hors scope ici) — household onboarding, fridge, receipt, shopping-list, recipe, settings — un incrément par bounded context, dans le même ordre que le backend.

## 1. Scope de cette phase

**Inclus :**
- App shell : layout racine, thème Tamagui (light/dark), routing conditionnel selon session.
- Auth : email/password (sign-in, sign-up) + PocketID (social sign-in via deep link).
- `FridgeConnector` : sous-ensemble identity (`getSession`, `signInEmail`, `signUpEmail`, `signInSocial`, `signOut`, `getAuthMethods`), implémenté par `HttpFridgeConnector` (réel) et `FakeFridgeConnector` (fixtures en mémoire), sélection via `EXPO_PUBLIC_CONNECTOR`.
- Plomberie TanStack Query générique (`define-query`, `define-mutation`, `use-domain-query`, `use-domain-mutation`, `connector-context`) — fondation réutilisée par toutes les phases suivantes.
- Un onglet placeholder post-connexion (utilisateur connecté + bouton déconnexion) — pas de contenu métier.

**Exclus (phases suivantes) :**
- Onboarding household (create/join) — phase 2 mobile.
- Tout écran fridge/receipt/shopping-list/recipe/settings.
- Design system Tamagui complet (`ui/button.tsx`, `card.tsx`, etc.) — construits au fil de l'eau, quand un écran en a réellement besoin.

## 2. `FridgeConnector` — extension incrémentale, pas une grande interface avec des placeholders

Phase 0 décrit `fridge-connector.ts` comme « une seule grande interface ». Cette phase l'initialise avec seulement les méthodes identity qu'elle utilise réellement :

```ts
// mobile/src/domain/interfaces/fridge-connector.ts
export interface FridgeConnector {
  getSession(): Promise<Session | null>
  getAuthMethods(): Promise<AuthMethod[]>
  signInEmail(email: string, password: string): Promise<Result<Session, ApiError>>
  signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>>
  signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>>
  signOut(): Promise<void>
}
```

Chaque phase mobile suivante étend cette interface (et les deux implémentations) avec les méthodes de son propre bounded context — même discipline que les `providers/*_provider.ts` du backend, un fichier par contexte, jamais un binding fourre-tout. Pas de méthode `throw new Error('not implemented')` pour un contexte pas encore construit : YAGNI, cohérent avec ADR-0010.

## 3. Session côté React Native — plugin officiel `@better-auth/expo`, pas une implémentation maison

**Révisé après recherche** (la version précédente de cette section proposait un stockage `expo-secure-store` fait main — remplacé par la solution officielle, trouvée après écriture de la première version de ce document, avant tout code) : better-auth publie un plugin serveur/client dédié à Expo qui résout exactement ce problème.

- **Backend** (`backend/src/infrastructure/auth/better-auth/instance.ts`) : ajouter `expo()` (import `@better-auth/expo`) au tableau `plugins` existant, à côté de `genericOAuth(...)`. `trustedOrigins` (déjà construit depuis `CORS_ORIGIN`, cf. code existant) doit inclure le scheme mobile — documenté en variable d'env (`CORS_ORIGIN` doit lister `fridgeai://` en prod, `exp://` en dev), aucun changement de code au-delà de l'ajout du plugin.
- **Mobile** : `createAuthClient` (`better-auth/react`) + plugin `expoClient({ scheme: 'fridgeai', storage: SecureStore, storagePrefix: 'fridgeai' })`. Le plugin gère lui-même : le jar de cookies virtuel (stocké via `expo-secure-store`), le cache de session (offline-friendly), et la conversion des callbacks OAuth relatifs en deep links.
- **`HttpFridgeConnector`** enveloppe ce `authClient` pour les méthodes identity (`signInEmail` → `authClient.signIn.email(...)`, `signInSocial` → `authClient.signIn.social({ provider: 'pocketid', callbackURL: '/(tabs)' })`, etc.), traduit son résultat en `Result<Session, ApiError>` — la façade `FridgeConnector` reste la même abstraction domaine, seule l'implémentation change en dessous. `FakeFridgeConnector` n'a besoin d'aucune de ces libs — fixtures pures en mémoire.
- Web (Expo web) : `expoClient` ne s'active que sur native ; sur web, `createAuthClient` retombe sur son comportement cookie-navigateur standard (`credentials: 'include'`) sans configuration supplémentaire — pas de branchement `Platform.OS` à écrire à la main.

Dépendances mobile ajoutées : `better-auth`, `@better-auth/expo`, `expo-secure-store`, `expo-linking`, `expo-web-browser`, `expo-constants`, `expo-network` (toutes listées comme requises par le plugin).

## 4. PocketID (OIDC) côté mobile

Géré entièrement par `@better-auth/expo` (cf. section 3) — `authClient.signIn.social({ provider: 'pocketid', callbackURL: '/(tabs)' })` déclenche le flow : ouverture du navigateur système (le plugin utilise `expo-web-browser` en interne), redirection vers `GET /api/auth/callback/pocketid` (backend, déjà câblé depuis Phase 1), conversion automatique du `callbackURL` relatif en deep link (`fridgeai://(tabs)`), fermeture automatique du navigateur au retour, session restaurée depuis `SecureStore`. Aucune logique de token-en-query-param à écrire côté backend ni côté app — c'est précisément ce que le plugin encapsule.

## 5. Fichiers de cette phase

```
mobile/
  package.json
  app.json                    # scheme: "fridgeai", nom, icônes placeholder
  tsconfig.json
  babel.config.js
  metro.config.js
  eslint.config.js
  .dependency-cruiser.cjs
  .env.example                # EXPO_PUBLIC_CONNECTOR, EXPO_PUBLIC_API_URL

  app/
    _layout.tsx                # redirige (auth) ↔ (tabs) selon session.query
    (auth)/
      _layout.tsx
      sign-in.tsx
      sign-up.tsx
    (tabs)/
      _layout.tsx
      index.tsx                 # placeholder : utilisateur connecté + sign-out

  src/
    domain/
      interfaces/fridge-connector.ts
      identity/{session.ts,user.ts,auth-method.ts}
      shared/{result.ts,api-error.ts}
    application/
      shared/{connector-context.tsx,define-query.ts,define-mutation.ts,use-domain-query.ts,use-domain-mutation.ts}
      identity/{session.query.ts,auth-methods.query.ts,sign-in.mutation.ts,sign-up.mutation.ts,sign-out.mutation.ts}
    infrastructure/
      auth/auth-client.ts           # createAuthClient + expoClient plugin (better-auth/react)
      http/{http-fridge-connector.ts,http-client.ts}
      fake/{fake-fridge-connector.ts,fixtures/session.fixture.ts}
    presentation/
      identity/{login-form.tsx,signup-form.tsx,auth-method-buttons.tsx}
      shared/{theme-provider.tsx,error-state.tsx}
    tamagui.config.ts

  providers/
    create-connector.ts          # choisit http/fake selon EXPO_PUBLIC_CONNECTOR

  __tests__/                     # jest-expo, un dossier par couche testée
```

Backend : un seul fichier modifié, `backend/src/infrastructure/auth/better-auth/instance.ts` — ajout de `expo()` au tableau `plugins` existant (cf. section 3).

## 6. Testing

`jest-expo` (préréglage Jest officiel Expo) + `@testing-library/react-native`. Pas de convention mobile existante dans ce repo — cette phase l'établit :
- `src/domain/**` : tests unitaires purs (VOs si besoin, mappers).
- `src/application/**` : tests de `define-query`/`define-mutation` avec un `FakeFridgeConnector` injecté.
- `src/presentation/**` : tests de rendu (`@testing-library/react-native`) sur les formulaires (sign-in, sign-up) avec le connector fake.
- Pas de test e2e (Detox/Maestro) dans cette phase — hors scope, potentiellement une phase dédiée plus tard si besoin.

## 7. Versions vérifiées (2026-08-26)

Phase 0 flaguait ces versions comme non vérifiées (contrairement au socle backend, déjà vérifié via `arr`) — vérifiées ici par recherche avant écriture du plan :

- **Expo SDK** : 57 (React Native 0.86)
- **expo-router** : 57.x (suit la version du SDK)
- **@tanstack/react-query** : 5.102.x
- **tamagui** : 2.7.x (v2, stable — v1 existe encore mais v2 est la branche active)
- **expo-web-browser** : 57.x · **expo-secure-store** : 57.x (toutes deux suivent le SDK, gérées par `expo install`)
- **better-auth** : déjà fixé côté backend à 1.6.x (cf. phase-0) — le mobile utilise `@better-auth/expo` en version compatible, résolue par `expo install`/`pnpm add` au moment du plan.

Le plan d'implémentation doit tout de même lancer `npx create-expo-app@latest` puis `npx expo install <pkg>` pour chaque dépendance plutôt que d'épingler ces numéros à la main — `expo install` résout les versions mutuellement compatibles pour le SDK installé, plus fiable qu'une liste figée qui peut driftée entre l'écriture de ce document et l'exécution du plan.

## 8. Enveloppe d'erreur

`ApiError` (mobile) reflète l'enveloppe backend existante (`{ error: { type, message, details? } }`, cf. `error-serializer.ts`) — pas de re-mapping, le connector renvoie directement `Result<T, ApiError>` avec `ApiError` structurellement identique au corps JSON reçu.
