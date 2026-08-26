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

## 3. Session côté React Native — pas de `document.cookie`

Le backend authentifie par cookie de session (better-auth). React Native n'a pas de `document.cookie` / jar de cookies automatique comme un navigateur classique.

**Décision :** `HttpFridgeConnector` extrait le cookie `Set-Cookie` de la réponse HTTP de sign-in/sign-up/callback OIDC, le stocke via `expo-secure-store` (chiffré, adapté à un token de session), et le réinjecte manuellement en header `Cookie` sur chaque requête suivante. Pas de lib de cookie-jar tierce — le protocole est simple (un seul cookie de session, pas de multi-domaine), donc une implémentation maison de quelques lignes dans `http-client.ts` suffit et reste auditable.

Web (Expo web) est un cas à part : le navigateur gère `document.cookie` nativement pour les requêtes `fetch` same-origin/CORS avec `credentials: 'include'` — `http-client.ts` détecte la plateforme (`Platform.OS === 'web'`) et laisse le navigateur faire le travail plutôt que de dupliquer la logique `expo-secure-store` qui n'existe pas là.

## 4. PocketID (OIDC) côté mobile

`expo-web-browser`'s `openAuthSessionAsync(authUrl, redirectUrl)` ouvre `GET {API_URL}/api/auth/sign-in/social?provider=pocketid&callbackURL={redirectUrl}` dans un onglet navigateur système (pas de WebView embarquée — meilleure sécurité, partage la session du navigateur système, pattern recommandé Expo/OAuth). Le callback OIDC du backend (`GET /api/auth/callback/pocketid`, déjà câblé côté backend depuis Phase 1) redirige vers un deep link enregistré dans `app.json` (`scheme: "fridgeai"`), que `expo-web-browser` intercepte et referme automatiquement.

Le cookie de session posé par le backend pendant ce flow doit être récupéré côté app après le retour du navigateur système — `openAuthSessionAsync`'s callback URL ne porte pas le `Set-Cookie` (le navigateur système, pas l'app, a reçu la réponse HTTP). **Décision :** après le retour du deep link, l'app appelle `GET /api/session` (déjà exposé, pas de foyer requis) pour vérifier si une session a été établie côté serveur — mais ce endpoint dépend lui-même du cookie envoyé par le client, qu'on n'a justement pas. Résolu en configurant le backend pour que le callback OIDC redirige avec le token de session en paramètre de query du deep link (`fridgeai://auth-callback?token=...`), que l'app échange contre le cookie en le stockant directement — **écart par rapport au flow web pur cookie-only**, documenté ici plutôt que découvert en implémentation. Nécessite un petit ajustement backend (le callback better-auth redirige déjà vers une URL configurable ; on pointe cette URL vers le deep link avec le token en query param, une convention standard pour les apps mobiles OAuth).

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
      http/{http-fridge-connector.ts,http-client.ts,session-storage.ts}
      fake/{fake-fridge-connector.ts,fixtures/session.fixture.ts}
    presentation/
      identity/{login-form.tsx,signup-form.tsx,auth-method-buttons.tsx}
      shared/{theme-provider.tsx,error-state.tsx}
    tamagui.config.ts

  providers/
    create-connector.ts          # choisit http/fake selon EXPO_PUBLIC_CONNECTOR

  __tests__/                     # jest-expo, un dossier par couche testée
```

## 6. Testing

`jest-expo` (préréglage Jest officiel Expo) + `@testing-library/react-native`. Pas de convention mobile existante dans ce repo — cette phase l'établit :
- `src/domain/**` : tests unitaires purs (VOs si besoin, mappers).
- `src/application/**` : tests de `define-query`/`define-mutation` avec un `FakeFridgeConnector` injecté.
- `src/presentation/**` : tests de rendu (`@testing-library/react-native`) sur les formulaires (sign-in, sign-up) avec le connector fake.
- Pas de test e2e (Detox/Maestro) dans cette phase — hors scope, potentiellement une phase dédiée plus tard si besoin.

## 7. Versions à vérifier avant de démarrer

Phase 0 flague ces versions comme non vérifiées (contrairement au socle backend, déjà vérifié via `arr`) : Expo SDK courant, `expo-router`, `@tanstack/react-query` (version mobile), `tamagui`, `expo-web-browser`, `expo-secure-store`. À faire en tout premier lieu du plan d'implémentation (souvent un simple `npx create-expo-app` + `npx expo install` pointe déjà vers les bonnes versions compatibles entre elles).

## 8. Enveloppe d'erreur

`ApiError` (mobile) reflète l'enveloppe backend existante (`{ error: { type, message, details? } }`, cf. `error-serializer.ts`) — pas de re-mapping, le connector renvoie directement `Result<T, ApiError>` avec `ApiError` structurellement identique au corps JSON reçu.
