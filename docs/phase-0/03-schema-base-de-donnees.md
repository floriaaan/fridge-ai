# Schéma de base de données

Postgres, migrations Lucid (`database/migrations/`), snake_case partout — même
convention qu'`arr`. Chaque table applicative est scopée `household_id`, jamais
`user_id` (cf. [ADR-0003](../adr/0003-household-agregat-un-seul-foyer-par-utilisateur.md)).

## Tables identity (better-auth)

Écrites à la main pour matcher le schéma core de better-auth (email/password +
`genericOAuth`), **sans** le plugin `admin` (cf.
[ADR-0004](../adr/0004-identity-sans-plugin-admin.md)) — donc pas de colonnes
`role`/`banned`/`ban_reason`/`ban_expires` sur `user`, pas de `impersonated_by` sur
`session`. À revérifier avec `npx @better-auth/cli generate` une fois la lib câblée,
comme le fait `arr` (cf. son ADR-0009).

```sql
CREATE TABLE "user" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  image           TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX session_user_id_idx ON session(user_id);

CREATE TABLE account (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  account_id                  TEXT NOT NULL,
  provider_id                 TEXT NOT NULL,
  access_token                TEXT,
  refresh_token               TEXT,
  access_token_expires_at     TIMESTAMPTZ,
  refresh_token_expires_at    TIMESTAMPTZ,
  scope                       TEXT,
  id_token                    TEXT,
  password                    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL,
  updated_at                  TIMESTAMPTZ NOT NULL
);
CREATE INDEX account_user_id_idx ON account(user_id);

CREATE TABLE verification (
  id          TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,
  value       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);
```

## household

```sql
CREATE TABLE household (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  owner_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  invite_code  TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_member (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Invariant "un seul foyer par utilisateur" appliqué en base, pas seulement en mémoire.
  CONSTRAINT household_member_user_id_unique UNIQUE (user_id)
);
CREATE INDEX household_member_household_id_idx ON household_member(household_id);
```

## product

```sql
CREATE TABLE product (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  receipt_id        TEXT REFERENCES receipt(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  quantity          INTEGER NOT NULL,
  unit              TEXT NOT NULL,
  location          TEXT NOT NULL CHECK (location IN ('fridge', 'freezer', 'pantry')),
  expires_at        TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  category          TEXT NOT NULL,
  openfoodfact_id   TEXT,
  categories        TEXT[],
  price             NUMERIC(10, 2),
  image_key         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_household_id_idx ON product(household_id);
CREATE INDEX product_expires_at_idx ON product(expires_at);
CREATE INDEX product_receipt_id_idx ON product(receipt_id);
```

*(déclarée après `receipt` dans l'ordre réel des migrations — FK circulaire évitée en
créant `receipt` sans dépendance vers `product`, `product.receipt_id` en second temps.)*

## receipt

```sql
CREATE TABLE receipt (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  store_name    TEXT NOT NULL,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount  NUMERIC(10, 2) NOT NULL,
  image_key     TEXT,
  items_count   INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX receipt_household_id_idx ON receipt(household_id);
```

## shopping_item

```sql
CREATE TABLE shopping_item (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      INTEGER NOT NULL,
  unit          TEXT NOT NULL,
  checked       BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL CHECK (source IN ('manual', 'auto_expired', 'recipe')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shopping_item_household_id_idx ON shopping_item(household_id);
```

## recipe / recipe_ingredient

```sql
CREATE TABLE recipe (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  source            TEXT NOT NULL CHECK (source IN ('ai', 'user')),
  instructions      TEXT NOT NULL,
  preparation_time  INTEGER,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  image_key         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recipe_household_id_idx ON recipe(household_id);

CREATE TABLE recipe_ingredient (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
  label       TEXT NOT NULL,
  quantity    INTEGER,
  unit        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recipe_ingredient_recipe_id_idx ON recipe_ingredient(recipe_id);
CREATE INDEX recipe_ingredient_product_id_idx ON recipe_ingredient(product_id);
```

## ai_provider_setting

Singleton — une seule ligne en pratique (appliqué au niveau applicatif via un
upsert dans `set-active-ai-provider.use-case.ts`, pas par contrainte SQL dédiée).
Pas de `household_id` : réglage d'instance, pas de foyer (cf.
[ADR-0007](../adr/0007-provider-ia-changeable-a-chaud.md)).

```sql
CREATE TABLE ai_provider_setting (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  active_provider  TEXT NOT NULL CHECK (active_provider IN ('gemini', 'openai', 'ollama')),
  updated_by       TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Diagramme relationnel (simplifié)

```
user 1───1 household_member N───1 household
                                     │ 1
                    ┌────────────────┼────────────────┬──────────────┐
                    │ N              │ N               │ N            │ N
                 product          receipt         shopping_item     recipe
                    │ N   1 ┘                                          │ 1
                    └───────────────────────────────────────────── recipe_ingredient N
                         (product_id nullable, ON DELETE SET NULL)
```

Toute suppression de `household` cascade sur tout son contenu (`ON DELETE CASCADE`).
Supprimer un `receipt` ne supprime pas ses `product` importés (`ON DELETE SET NULL`
sur `product.receipt_id`) — la traçabilité se perd mais pas l'inventaire réel du
frigo.
