# Mobile Fridge Inventory : Design

**Statut:** approuvé (2026-08-28)

## Contexte

Backend Phase 2 (`docs/superpowers/plans/2026-08-26-phase-2-fridge-receipt-settings.md`) couvre déjà fridge/receipt/settings côté serveur, mergé sur `main`. Côté mobile, Phase 1 (identity) et Phase 4 (dashboard, recipes, shopping-list) sont mergées ; le bounded context fridge n'a aucun écran mobile.

Comme pour le backend, ce bounded context se découpe en trois sous-projets mobiles indépendants, chacun avec son propre cycle spec → plan → implémentation :

1. **Fridge inventory (ce document)** — liste/détail/CRUD produits, lookup barcode.
2. Receipt (hors scope ici) — scan/import de tickets de caisse.
3. Settings (hors scope ici) — gestion membres household, provider IA actif.

## 1. Scope

**Inclus :**
- Liste des produits du fridge (filtre par `location`, badge "expire bientôt" via `expiringWithinDays`).
- Détail d'un produit.
- Formulaire add/edit (création + modification), avec suppression depuis le détail.
- Lookup produit par code-barres (`GET /api/products/lookup`) pour pré-remplir le formulaire.
- Écran scanner dédié (`expo-camera`, `CameraView` + barcode scanning) — modal plein écran, pas un simple champ dans le formulaire.
- Nouvel onglet `fridge` dans `(tabs)`, au même niveau que `recipes`/`shopping-list`.

**Exclus (hors scope, autres sous-projets ou plus tard) :**
- Upload photo produit (`imageKey`, `GET /products/:id/image`) — pas consommé ce phase-ci. On affiche `imageUrl` si le lookup OpenFoodFacts en fournit une, rien de plus.
- Receipt scan/import.
- Settings (membres, provider IA).
- Tri/recherche avancée, pagination — la liste backend n'est pas paginée, le scope mobile ne l'ajoute pas non plus.

## 2. `FridgeConnector` — extension du groupe `fridge`

Même discipline que Phase 1 (`docs/superpowers/specs/2026-08-26-mobile-phase-1-identity-design.md` section 2) et Phase 4 : un groupe de méthodes par bounded context, ajouté seulement quand ce phase les consomme réellement.

```ts
// mobile/src/domain/interfaces/fridge-connector.ts — ajout
getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]>
getProduct(productId: string): Promise<Product | null>
createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>>
updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>>
deleteProduct(productId: string): Promise<Result<void, ApiError>>
getExpiringSoonProducts(days?: number): Promise<Product[]>
lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null>
```

`HttpFridgeConnector` appelle les routes backend existantes (`/api/products*`, cf. `backend/src/presentation/fridge/product.routes.ts`) via le `http-client` déjà en place. `FakeFridgeConnector` reçoit des fixtures en mémoire (`fixtures/product.fixture.ts`, `fixtures/product-lookup.fixture.ts`), miroir du pattern `shopping-item.fixture.ts`/`recipe.fixture.ts`.

## 3. Domain

`mobile/src/domain/fridge/` — miroir du domaine backend, adapté au mobile (pas de règles métier dupliquées, juste les types + VOs nécessaires à l'affichage et au formulaire) :

- `product.ts` — type `Product` (mêmes champs que `ProductDto` backend : `id`, `name`, `quantity`, `location`, `expiresAt`, `openedAt`, `category`, `categories`, `openfoodfactId`, `receiptId`, `price`, `imageKey`, `createdAt`, `updatedAt`).
- `quantity.ts` — VO `{ amount: number; unit: string }`, validation miroir backend (entier > 0, unité non vide) pour feedback immédiat côté formulaire avant round-trip réseau.
- `location.ts` — union `'fridge' | 'freezer' | 'pantry'`.
- `product-lookup-result.ts` — type `ProductLookupResult` (`name`, `category`, `categories`, `imageUrl`, `openfoodfactId`), miroir `ProductLookupPort` backend.

## 4. Application (TanStack Query)

`mobile/src/application/fridge/`, un fichier par opération, suivant `define-query`/`define-mutation` déjà en place (Phase 1) :

- `products.query.ts` — liste, paramétrable par `location`/`expiringWithinDays`.
- `product.query.ts` — détail par id.
- `product-lookup.query.ts` — lookup par barcode (query, pas mutation : lecture idempotente, mais déclenchée manuellement via `enabled: false` + `refetch`).
- `create-product.mutation.ts`, `update-product.mutation.ts`, `delete-product.mutation.ts` — invalident `products.query` (et `product.query` pour update/delete) après succès.

## 5. Présentation — écrans

`mobile/src/presentation/fridge/` :

- `fridge-list-screen.tsx` — liste des produits, filtre par `location` (segmented control ou tabs internes fridge/freezer/pantry), badge visuel sur les produits expirant bientôt (réutilise `getExpiringSoonProducts` ou dérive côté client depuis la date — décision d'implémentation, pas de contrainte design ici). Tap → détail. FAB ou bouton → formulaire (nouveau produit).
- `fridge-detail-screen.tsx` — affichage complet d'un produit, boutons éditer/supprimer (confirm avant delete).
- `fridge-form-screen.tsx` — création/édition, champs miroir `CreateProductProps`/`UpdateProductProps`. Bouton "Scanner un code-barres" ouvre le scanner.
- `barcode-scanner-screen.tsx` — modal plein écran, `expo-camera` `CameraView` avec `onBarcodeScanned`. Barcode détecté → appelle `product-lookup.query` → résultat trouvé : pré-remplit `name`/`category`/`categories`/`openfoodfactId`/`imageUrl` dans le formulaire et ferme le modal ; résultat `null` : toast "produit non trouvé, remplis à la main", modal se ferme, formulaire reste vide.

Nav : `mobile/src/app/(tabs)/fridge.tsx` (nouvel onglet), plus routes `app/(tabs)/fridge/[id].tsx` (détail), `app/(tabs)/fridge/new.tsx` et `app/(tabs)/fridge/[id]/edit.tsx` (formulaire), `app/(tabs)/fridge/scan.tsx` (scanner, présenté en modal via `expo-router` `presentation: 'modal'`) — structure de routing exacte à trancher au moment du plan selon les conventions déjà posées par `recipes`/`shopping-list`.

## 6. Erreurs

`Result<T, ApiError>` partout où le backend peut échouer (create/update/delete) — même enveloppe que Phase 1 (`ApiError` structurellement identique au corps JSON `{ error: { type, message, details? } }`). Erreurs de validation (quantity/location invalides) affichées inline sur le formulaire. Lookup barcode sans résultat : pas une erreur `ApiError` (le backend renvoie `{ result: null }` avec 200), traité comme un cas métier normal (toast informatif, pas un état d'erreur).

## 7. Dépendances ajoutées

`expo-camera` (CameraView + barcode scanning, inclut la demande de permission caméra) — version résolue via `expo install expo-camera` au moment du plan, pas épinglée ici (même règle que Phase 1 section 7).

## 8. Testing

Même convention que les phases précédentes :
- `src/domain/fridge/**` : tests unitaires des VOs (`Quantity`, `Location`).
- `src/application/fridge/**` : tests des queries/mutations avec `FakeFridgeConnector`.
- `src/presentation/fridge/**` : tests de rendu (liste, formulaire — validation inline, cas scan → pré-remplissage) avec `@testing-library/react-native`.
- Pas de test e2e caméra réelle — le scanner est testé via son handler `onBarcodeScanned` appelé directement dans les tests, pas via la lib caméra elle-même (non simulable en Jest).
