# Mobile shopping-list CRUD — Design

**Statut:** approuvé (2026-08-29)

## Contexte

Sub-project 3/4 du mobile fridge/receipt/settings/shopping-list/recipe work (après identity, fridge-inventory, receipt-scan+settings). `shopping-list-screen.tsx` existe déjà mais est disclosed en scope "read + toggle-checked only" — `getShoppingItems`/`toggleShoppingItem` sont câblés, `POST`/`PATCH`/`DELETE /api/shopping-items` ne le sont pas. Ce sub-project ferme cet écart : create, edit (nom/quantité), delete.

Le sub-project 4/4 (recipe — détail, génération IA, suggestions) est explicitement hors scope ici ; `recipe-list-screen.tsx` reste en l'état.

## 1. Domain + connector

`domain/shopping-list/shopping-item.ts` gagne deux types, même forme que `CreateProductInput`/`UpdateProductInput` :

```ts
export interface CreateShoppingItemInput {
  name: string
  quantity: { amount: number; unit: string }
}

export interface UpdateShoppingItemInput {
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}
```

`source` n'est pas un champ du formulaire : le backend le fixe à `'manual'` pour tout item créé par l'app (les sources `'auto_expired'`/`'recipe'` viennent d'ailleurs, jamais de ce formulaire) — `CreateShoppingItemInput` ne le porte donc pas.

`FridgeConnector` (`domain/interfaces/fridge-connector.ts`) : `toggleShoppingItem` est remplacé par un `updateShoppingItem` générique — le toggle devient un patch `{ checked }` parmi d'autres, comme `updateProduct` couvre déjà tous les patchs produit sans méthode dédiée par champ.

```ts
createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>>
```

Implémenté dans `http-fridge-connector.ts` (`POST`/`PATCH`/`DELETE /api/shopping-items[/:id]`, même shape d'erreur que `updateProduct`/`deleteProduct`) et `fake-fridge-connector.ts` (mutation de fixture in-place, même style que le fake existant).

## 2. Application layer

- `useCreateShoppingItemMutation` (nouveau)
- `useUpdateShoppingItemMutation` (remplace `useToggleShoppingItemMutation` — le seul appelant actuel, `shopping-list-screen.tsx`, passe de `toggle.mutate({ itemId, checked })` à `update.mutate({ itemId, patch: { checked } })`)
- `useDeleteShoppingItemMutation` (nouveau)

Toutes invalident `['shopping-items']` au succès, même pattern que l'existant (`queryClient.invalidateQueries` côté écran, pas dans la mutation elle-même — cohérent avec le commentaire déjà présent dans `shopping-list-screen.tsx` sur pourquoi l'invalidation explicite est nécessaire contre le vrai backend).

## 3. Presentation

### `shopping-item-form-screen.tsx` (nouveau, `presentation/shopping-list/`)

Même structure que `fridge-form-screen.tsx` : un seul composant, `{ mode: 'create' } | { mode: 'edit'; itemId: string }`, deux champs (`FormField` — déjà extrait en composant partagé côté fridge ; réutilisé tel quel, pas dupliqué) : nom, quantité (amount + unit). En édition, précharge depuis `useShoppingItemsQuery` (pas de query par-id dédiée — la liste est déjà en cache, un item de plus ne justifie pas un nouvel endpoint/query `GET /api/shopping-items/:id` qui n'existe pas côté backend).

Validation client avant submit : nom non vide, `amount` un nombre positif — même niveau de rigueur que `Quantity.create` côté fridge (réutilise le VO `Quantity` existant plutôt que d'en écrire un nouveau).

Bouton "Enregistrer" (lime, pill, même style que `fridge-form-submit`) ; erreur serveur affichée en `expiredText`, mêmes conventions.

### `ShoppingRow` — swipe pour delete + entrée en édition

Le tap sur la row reste le toggle checked (comportement inchangé, action la plus fréquente). Un swipe (gauche) révèle deux actions côte à côte : "Modifier" (navigue vers l'edit route) et "Supprimer" (rouge `expiredBg`/`expiredText`, exécute directement — pas de dialogue de confirmation, cohérent avec le geste de swipe natif iOS/Android où le swipe lui-même *est* l'étape d'intention, contrairement au bouton "Supprimer" du détail produit qui n'a pas ce filtre gestuel et garde donc son double-tap confirm).

Implémenté avec `Swipeable` de `react-native-gesture-handler` (déjà une dépendance du projet, ~2.32.0, non utilisée ailleurs pour l'instant — première introduction de ce pattern dans l'app, justifiée en 4 ici par le fait que c'est le contrôle de liste natif attendu sur les deux plateformes, pas un pattern web porté). Le geste ne s'applique qu'aux rows non-checked et checked indifféremment (éditer/supprimer un item déjà coché reste légitime).

### FAB sur `shopping-list-screen.tsx`

Absent aujourd'hui (le écran n'a même pas de FAB placeholder). Ajouté en bas à droite (mobile) / en haut de la card content (desktop, à côté du header, comme le pattern dashboard), lime, `router.push('/(tabs)/shopping-list/new')`. Le hint "bientôt disponible" disparaît de ce chemin ; le `onScan` du `Sidebar` desktop (actuellement un hint stub, hors scope shopping-list) reste inchangé.

### Routes — `shopping-list.tsx` devient un dossier stack, miroir exact de la convention `fridge/`

```
app/(tabs)/shopping-list/
  _layout.tsx        # Stack, headerShown: false, screens: index, new, [id]/edit
  index.tsx          # ShoppingListScreen (contenu actuel du fichier plat déplacé ici)
  new.tsx             # <ShoppingItemFormScreen mode="create" />
  [id]/edit.tsx        # <ShoppingItemFormScreen mode="edit" itemId={id} />
```

`app/(tabs)/_layout.tsx` (le `Tabs`) référence déjà `shopping-list` par nom de dossier — aucun changement requis là, `expo-router` résout `shopping-list/index` comme la même route que l'actuel fichier plat.

## 4. États et erreurs

- Liste vide : inchangé (déjà géré).
- Erreur réseau sur create/edit : affichée dans le formulaire, pas de retour en arrière automatique (même pattern que `fridge-form-screen`).
- Erreur réseau sur delete (swipe) : le row revient à sa position (le swipe se referme) et un `HintBubble` affiche l'erreur — pas de blocage d'écran pour une action tentée depuis une liste.
- Optimistic update : hors scope — chaque mutation attend la réponse puis invalide, comme l'existant `toggleShoppingItem`. Pas d'UI optimiste ajoutée dans ce sub-project.

## 5. Tests

- `http-fridge-connector.test.ts` : cas pour `createShoppingItem`/`updateShoppingItem`/`deleteShoppingItem` (succès + erreur), même style que les tests `createProduct`/`updateProduct`/`deleteProduct` existants.
- `fake-fridge-connector.test.ts` : idem côté fake.
- `shopping-item-form-screen.test.tsx` (nouveau) : create, edit (préchargement + submit), validation client, erreur serveur — miroir de `fridge-form-screen.test.tsx`.
- `shopping-list-screen.test.tsx` (existant, à étendre) : FAB navigue vers `new`, swipe→modifier navigue vers `[id]/edit`, swipe→supprimer appelle la mutation et invalide la query, erreur de delete affiche le hint.

## Hors scope (explicite)

- Recipe (détail, génération IA, suggestions) — sub-project 4/4, spec séparée.
- UI optimiste sur les mutations shopping-list.
- Réordonnancement manuel des items (pas dans les endpoints backend, pas demandé).
- `GET /api/shopping-items/:id` — n'existe pas côté backend ; l'édition précharge depuis la liste en cache.
