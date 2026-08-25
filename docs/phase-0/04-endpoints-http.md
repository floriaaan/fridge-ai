# Endpoints HTTP

Toutes les routes `/api/*` sauf `/health`. Auth par cookie de session (better-auth).
Sauf mention contraire, chaque endpoint applicatif exige une session valide **et** un
foyer (`household_required_middleware`) — répond `401` sans session, `403` sans foyer
(sauf le groupe `identity` qui gère justement l'onboarding avant d'avoir un foyer).

## identity

### `ANY /api/auth/*`

Délégué intégralement à better-auth (bridge fetch, copié tel quel du pattern `arr`) :
- `POST /api/auth/sign-up/email` — `{ email, password, name }` → crée le compte
- `POST /api/auth/sign-in/email` — `{ email, password }`
- `GET /api/auth/sign-in/social?provider=pocketid` — démarre le flow OIDC
- `GET /api/auth/callback/pocketid` — callback OIDC
- `POST /api/auth/sign-out`

### `GET /api/session`

Pas de foyer requis.

```jsonc
// 200
{ "user": { "id": "u_1", "email": "a@b.com", "name": "Alice", "image": null } | null }
```

### `GET /api/auth/methods`

Public, pas de session requise — l'app en a besoin *avant* de savoir qui se connecte,
pour savoir quels boutons afficher. Extensible (passkeys, Google… plus tard sans
casser le contrat).

```jsonc
// 200
{
  "methods": [
    { "id": "password", "enabled": true, "label": "Email et mot de passe" },
    { "id": "pocketid", "enabled": true, "label": "PocketID" }
  ]
}
```

### `GET /api/households/mine`

Pas de foyer requis (c'est justement l'endpoint qui répond `null` si aucun).

```jsonc
// 200 — membre d'un foyer
{
  "household": {
    "id": "h_1",
    "name": "Chez nous",
    "inviteCode": "K3F9QX2A",   // présent seulement si le caller est owner
    "role": "owner",
    "members": [
      { "userId": "u_1", "name": "Alice", "role": "owner", "joinedAt": "2026-08-25T10:00:00Z" },
      { "userId": "u_2", "name": "Bob", "role": "member", "joinedAt": "2026-08-25T11:00:00Z" }
    ]
  } | null
}
```

### `POST /api/households`

```jsonc
// requête
{ "name": "Chez nous" }
// 201
{ "household": { "id": "h_1", "name": "Chez nous", "inviteCode": "K3F9QX2A", "role": "owner" } }
```
`409` si le caller appartient déjà à un foyer.

### `POST /api/households/join`

```jsonc
// requête
{ "inviteCode": "K3F9QX2A" }
// 200
{ "household": { "id": "h_1", "name": "Chez nous", "role": "member" } }
```
`404` code invalide. `409` si le caller appartient déjà à un foyer.

### `POST /api/households/invite-code/regenerate`

Owner uniquement. `200 { "inviteCode": "NEWCODE1" }`. `403` si caller n'est pas owner.

### `DELETE /api/households/members/:userId`

Owner uniquement, ne peut pas se cibler soi-même. `204`. `403` sinon.

### `POST /api/households/leave`

Member uniquement (`409` si owner — doit supprimer le foyer à la place). `204`.

### `DELETE /api/households/mine`

Owner uniquement. Supprime le foyer et cascade tout son contenu. `204`.

---

## fridge (produits)

### `GET /api/products?location=fridge&expiringWithinDays=3`

Query params optionnels, combinables.

```jsonc
// 200
{ "products": [ { "id": "p_1", "name": "Lait", "quantity": { "amount": 1, "unit": "L" },
  "location": "fridge", "expiresAt": "2026-08-28T00:00:00Z", "openedAt": null,
  "category": "Produits laitiers", "categories": ["dairy"], "openfoodfactId": "3017620422003",
  "receiptId": null, "price": 1.2, "imageKey": null, "createdAt": "...", "updatedAt": "..." } ] }
```

### `POST /api/products`

```jsonc
// requête
{ "name": "Lait", "quantity": { "amount": 1, "unit": "L" }, "location": "fridge",
  "expiresAt": "2026-08-28", "category": "Produits laitiers",
  "openfoodfactId": "3017620422003", "categories": ["dairy"] }
// 201 → { "product": { ...même forme que ci-dessus } }
```

### `GET /api/products/:id` · `PATCH /api/products/:id` · `DELETE /api/products/:id`

`PATCH` : mêmes champs que `POST`, tous optionnels. `404` hors du foyer du caller.

### `GET /api/products/expiring-soon?days=3`

Par défaut `days=3`. `200 { "products": [...] }` (même DTO).

### `GET /api/products/lookup?barcode=3017620422003`

Appel serveur vers OpenFoodFacts, ne persiste rien — prefill du formulaire de création.

```jsonc
// 200 — trouvé
{ "result": { "name": "Nutella", "category": "Pâtes à tartiner", "categories": ["spreads"],
  "imageUrl": "https://...", "openfoodfactId": "3017620422003" } }
// 200 — non trouvé
{ "result": null }
```

---

## receipt

### `POST /api/receipts/scan`

`multipart/form-data`, champ `image`. Ne persiste rien — retourne un draft éditable.

```jsonc
// 200
{ "draft": { "storeName": "Carrefour", "scannedAt": "2026-08-25T18:00:00Z",
  "totalAmount": 23.47,
  "items": [ { "name": "Lait 1L", "quantity": 2, "unit": "piece", "category": "Produits laitiers", "price": 2.4 } ] } }
```
`422` si l'image n'est pas exploitable (réponse IA vide/malformée).

### `POST /api/receipts/import`

Le draft, potentiellement édité côté app, plus la localisation/expiry choisies par
l'utilisateur pour chaque item (l'IA ne devine pas où range le produit ni sa date de
péremption réelle).

```jsonc
// requête
{ "storeName": "Carrefour", "scannedAt": "2026-08-25T18:00:00Z", "totalAmount": 23.47,
  "imageKey": "receipts/abc123.jpg",
  "items": [ { "name": "Lait 1L", "quantity": 2, "unit": "piece", "category": "Produits laitiers",
    "price": 2.4, "location": "fridge", "expiresAt": "2026-09-01" } ] }
// 201
{ "receipt": { "id": "r_1", "storeName": "Carrefour", "itemsCount": 1, ... },
  "products": [ { "id": "p_2", "name": "Lait 1L", ... } ] }
```

### `GET /api/receipts` · `GET /api/receipts/:id`

Liste/détail, scopés foyer. Le détail inclut `products: Product[]` (via `receiptId`).

### `GET /api/receipts/:id/image`

Stream l'image (`image/jpeg`), `404` si absente ou hors foyer. Pas de `Content-Disposition:
attachment` — affichage inline dans l'app.

---

## shopping-list

### `GET /api/shopping-items`

```jsonc
{ "items": [ { "id": "s_1", "name": "Farine", "quantity": { "amount": 1, "unit": "kg" },
  "checked": false, "source": "manual", "createdAt": "...", "updatedAt": "..." } ] }
```

### `POST /api/shopping-items`

```jsonc
{ "name": "Farine", "quantity": { "amount": 1, "unit": "kg" }, "source": "manual" }
```

### `PATCH /api/shopping-items/:id`

```jsonc
{ "checked": true }   // ou name/quantity
```

### `DELETE /api/shopping-items/:id`

---

## recipe

### `GET /api/recipes`

```jsonc
{ "recipes": [ { "id": "rc_1", "title": "Gratin de courgettes", "source": "ai",
  "preparationTime": 30, "tags": ["végétarien"], "imageKey": null, "createdAt": "..." } ] }
```

### `GET /api/recipes/:id`

Inclut `ingredients: RecipeIngredient[]` et `instructions`.

### `POST /api/recipes/generate`

```jsonc
// requête
{ "prompt": "quelque chose de rapide pour ce soir" }   // optionnel
// 201
{ "recipes": [ { "id": "rc_2", "title": "...", "instructions": "...", "ingredients": [...] } ] }
```
Contexte envoyé au provider IA : produits actuels du foyer (nom/catégorie/expiresAt) +
`prompt` si fourni.

### `GET /api/recipes/suggestions`

Comme `generate`, mais sans `prompt` et avec `prioritizeExpiringSoon: true` — biaisé
vers les produits proches de la péremption. Ne persiste rien (contrairement à
`generate`, qui sauvegarde) : suggestions jetables tant que l'utilisateur ne les
sauvegarde pas explicitement (`POST /api/recipes` avec une recette suggérée, même forme
que la réponse de `suggestions`).

### `POST /api/recipes`

Sauvegarde une suggestion (ou une recette manuelle, `source: "user"`).

```jsonc
{ "title": "...", "instructions": "...", "source": "user", "ingredients": [...] }
```

### `DELETE /api/recipes/:id`

---

## settings (instance-wide, pas de foyer requis)

### `GET /api/settings/ai`

Toute session valide suffit (pas besoin d'être owner pour lire).

```jsonc
// 200
{ "activeProvider": "gemini", "source": "database",   // "database" | "environment"
  "availableProviders": ["gemini", "openai"] }         // ceux dont les credentials sont configurés en env
```

### `PATCH /api/settings/ai`

Owner de foyer uniquement (n'importe lequel — réglage d'instance, cf.
[ADR-0007](../adr/0007-provider-ia-changeable-a-chaud.md)).

```jsonc
// requête
{ "activeProvider": "openai" }
// 200
{ "activeProvider": "openai", "source": "database" }
```
`403` si caller n'est owner d'aucun foyer. `422` si `activeProvider` absent de
`availableProviders` (credentials manquants en env pour ce provider).

## Divers

### `GET /health`

Pas d'auth. `200 { "status": "ok" }` — même contrat que le healthcheck Docker `arr`.

### `GET /api/products/:id/image`

Même logique que `GET /api/receipts/:id/image`, pour les photos de produit (si
ajoutées manuellement par l'utilisateur — pas de photo auto pour un produit créé via
code-barres/reçu, sauf celle du reçu source).

---

## Enveloppe d'erreur (commune à tous les endpoints)

Même forme qu'`arr` (`error-serializer.ts`) :

```jsonc
// 4xx/5xx
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "field": "name", "message": "..." } ] } }
```
