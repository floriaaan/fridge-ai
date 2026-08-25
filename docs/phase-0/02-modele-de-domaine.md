# Modèle de domaine

5 bounded contexts : **identity**, **fridge**, **receipt**, **shopping-list**, **recipe**.
Tout ce qui n'est pas `identity` est scopé par `householdId` — jamais `userId`
directement (cf. [ADR-0003](../adr/0003-household-agregat-un-seul-foyer-par-utilisateur.md)).

Noyau tactique partagé (`domain/shared/`), copié tel quel du pattern `arr` : `Entity`,
`AggregateRoot`, `ValueObject`, `DomainEvent`, `Result`, `ValidationError`,
`Clock`/`IdGenerator` (ports d'infra même pour du non-métier, pour rester testable
sans horloge/uuid réels).

## identity

### `User` (entity)

Propriétaire : better-auth (table `user`, gérée hors du domaine applicatif — le
domaine ne fait que *lire* via `UserDirectory`, jamais écrire directement).

```ts
class User {
  id: string
  email: Email        // vo
  name: string
  image: string | null
}
```

### `Household` (aggregate root)

Racine d'agrégat pour l'appartenance à un foyer. Porte l'invariant "un seul owner",
et la génération/régénération du code d'invitation.

```ts
class Household extends AggregateRoot {
  id: string
  name: string
  ownerId: string           // userId — toujours aussi présent comme HouseholdMember(role='owner')
  inviteCode: InviteCode
  members: HouseholdMember[]
  createdAt: Date

  static create(props: { name: string; ownerId: string }): Household
  regenerateInviteCode(): void
  addMember(userId: string): Result<void>       // erreur si déjà membre d'un autre foyer (vérifié via repository, pas dans l'agrégat)
  removeMember(userId: string): Result<void>     // erreur si userId === ownerId
}
```

### `HouseholdMember` (entity, interne à l'agrégat `Household`)

```ts
class HouseholdMember {
  userId: string
  householdId: string
  role: HouseholdRole      // vo: 'owner' | 'member'
  joinedAt: Date
}
```

### Value objects

- `Email` — validation format, égalité par valeur
- `HouseholdRole` — `'owner' | 'member'`, deux valeurs seulement (pas de permissions
  fines v1)
- `InviteCode` — code court (8 caractères alphanumériques), généré aléatoirement,
  unique en base
- `AuthMethod` — décrit une méthode d'auth exposable au front :
  `{ id: 'password' | 'pocketid'; enabled: boolean; label: string }`

### Ports (interfaces)

- `AuthenticationPort` — vérifie une session, résout l'utilisateur courant (adapter :
  better-auth)
- `SessionPort` — invalide une session (sign-out)
- `UserDirectory` — lecture seule sur la table `user` de better-auth
- `HouseholdRepository` — `findByUserId`, `findByInviteCode`, `save`, `delete`
- `AuthMethodsProvider` — résout la liste des `AuthMethod[]` effectivement disponibles
  (password toujours activé sauf variable d'env de désactivation ; PocketID actif si
  `POCKETID_CLIENT_ID`/`SECRET`/`ISSUER_URL` sont configurés)

### Invariant clé

Un `userId` apparaît dans **au plus un** `HouseholdMember` à la fois — appliqué par une
contrainte unique en base (`unique(user_id)` sur `household_member`), pas seulement en
mémoire. Rejoindre un foyer alors qu'on appartient déjà à un autre échoue explicitement
(pas de transfert automatique).

---

## fridge

### `Product` (entity, racine — pas d'agrégat parent, appartient directement au foyer)

```ts
class Product {
  id: string
  householdId: string
  name: string
  quantity: Quantity           // vo { amount: number > 0; unit: string }
  location: Location           // vo: 'fridge' | 'freezer' | 'pantry'
  expiresAt: Date | null
  openedAt: Date | null
  category: string
  openfoodfactId: string | null
  categories: string[] | null
  receiptId: string | null     // traçabilité, nullable — set null si le reçu est supprimé
  price: number | null
  imageKey: string | null      // clé de stockage opaque, jamais une URL publique
  createdAt: Date
  updatedAt: Date

  static create(props: CreateProductProps): Product
  update(props: UpdateProductProps): void
  isExpiringSoon(withinDays: number, now: Date): boolean
  isExpired(now: Date): boolean
}
```

### Value objects

- `Location` — `'fridge' | 'freezer' | 'pantry'`
- `Quantity` — `{ amount: number; unit: string }`, invariant `amount > 0`

### Ports

- `ProductRepository` — CRUD + `findByHousehold(householdId, filters)`,
  `findExpiringSoon(householdId, withinDays)`
- `ProductLookupPort` — `lookupByBarcode(barcode): Promise<ProductLookupResult | null>`
  (adapter : OpenFoodFacts, seul appelant externe pour ce port)

---

## receipt

### `Receipt` (entity)

Créé uniquement au moment de l'import confirmé — jamais à l'étape de scan/extraction
(cf. [ADR-0006](../adr/0006-extraction-ia-multimodale-sans-ocr-separe.md)).

```ts
class Receipt {
  id: string
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: Date
  updatedAt: Date
}
```

### `ReceiptDraft` (value object, jamais persisté tel quel)

Résultat brut de l'extraction IA, retourné à l'app pour confirmation/édition avant
import.

```ts
interface ReceiptDraft {
  storeName: string
  scannedAt: Date
  totalAmount: number
  items: ReceiptDraftItem[]
}

interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
}
```

### Ports

- `ReceiptRepository` — CRUD, `findByHousehold(householdId)`
- `ReceiptExtractionPort` — `extract(image: Buffer): Promise<ReceiptDraft>` (adapter :
  provider IA actif, vision)

---

## shopping-list

### `ShoppingItem` (entity)

```ts
class ShoppingItem {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  checked: boolean
  source: ShoppingItemSource   // vo: 'manual' | 'auto_expired' | 'recipe'
  createdAt: Date
  updatedAt: Date

  toggle(): void
}
```

### Ports

- `ShoppingItemRepository` — CRUD, `findByHousehold(householdId)`

---

## recipe

### `Recipe` (aggregate root)

```ts
class Recipe extends AggregateRoot {
  id: string
  householdId: string
  title: string
  description: string | null
  source: RecipeSource         // vo: 'ai' | 'user'
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: Date
}
```

### `RecipeIngredient` (entity, interne à l'agrégat `Recipe`)

```ts
class RecipeIngredient {
  id: string
  recipeId: string
  productId: string | null    // lien optionnel vers un Product du foyer
  label: string
  quantity: number | null
  unit: string | null
}
```

### Ports

- `RecipeRepository` — CRUD, `findByHousehold(householdId)`
- `RecipeGenerationPort` — `generate(context: RecipeGenerationContext): Promise<RecipeDraft[]>`
  (adapter : provider IA actif, texte). `RecipeGenerationContext` porte la liste des
  produits du foyer (nom/catégorie/expiresAt) + un `prompt` libre optionnel + un flag
  `prioritizeExpiringSoon` (utilisé par le use-case suggestions).

---

## settings

Seul bounded context qui n'est **pas** scopé `householdId` — réglage d'instance,
pas de foyer (cf. [ADR-0007](../adr/0007-provider-ia-changeable-a-chaud.md)).

### `AiProviderSettings` (aggregate root, singleton)

```ts
class AiProviderSettings extends AggregateRoot {
  id: string
  activeProvider: AiProvider    // vo: 'gemini' | 'openai' | 'ollama'
  updatedBy: string | null      // userId de l'owner qui a fait le dernier changement
  updatedAt: Date

  static seedFromEnv(defaultProvider: AiProvider): AiProviderSettings
  changeProvider(provider: AiProvider, changedBy: string): Result<void>
}
```

### `EffectiveAiSettings` (value object, jamais persisté)

Résultat de `AiSettingsProvider.resolveEffective()` — fusionne la ligne DB (si elle
existe) avec le défaut `AI_PROVIDER` de l'env.

```ts
interface EffectiveAiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]   // ceux dont les credentials sont présents en env
}
```

### Ports

- `AiProviderSettingsRepository` — `find()`, `save()` (upsert singleton)
- `AiSettingsProvider` — `resolveEffective(): Promise<EffectiveAiSettings>` (adapter :
  fusionne `AiProviderSettingsRepository` + lecture des variables d'env de
  credentials pour calculer `availableProviders`)

`ReceiptExtractionPort` et `RecipeGenerationPort` (définis dans `receipt`/`recipe`)
restent inchangés — c'est `ai-provider-registry.ts` (infrastructure) qui résout quel
adapter les implémente, en interrogeant `AiSettingsProvider` à chaque appel (avec
cache invalidé sur changement de signature, même mécanisme que le hot-reload OIDC
d'`arr`).

---

## Diagramme de dépendances entre contextes

```
identity ← (householdId) ← fridge, receipt, shopping-list, recipe
fridge   ← (receiptId, optionnel) ← receipt
fridge   ← (productId, optionnel) ← recipe (via RecipeIngredient)
```

Aucune dépendance inverse : `identity` ne connaît rien des autres contextes, `fridge`
ne connaît pas `recipe`. Les liens `receiptId`/`productId` sont de simples clés
étrangères optionnelles (traçabilité), jamais des appels de méthode inter-agrégats.
