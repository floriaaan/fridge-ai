# ADR-0001 — Lucid + migrations, pas Drizzle

## Contexte

L'original `~/dev/fridge` (backend Elysia) utilisait Drizzle ORM avec schéma
TypeScript déclaratif (`schema.ts`) et migrations générées. Le backend de fridge-ai
est AdonisJS, dont l'ORM natif est Lucid (migrations impératives + Active Record-like
model, avec repository/mapper au-dessus pour respecter le DDD strict). `~/dev/arr`
utilise déjà Lucid avec succès dans la même architecture en couches.

## Décision

Lucid + migrations SQL impératives, pas Drizzle. Chaque table a un modèle Lucid sous
`src/infrastructure/persistence/**/*.lucid.ts`, jamais exposé hors de son repository
(`*.repository.ts`), avec un `*.mapper.ts` pour la conversion modèle Lucid ↔ entité de
domaine.

## Conséquences

- Cohérent avec `arr` : même outillage CLI (`node ace migration:run`), même pattern de
  test, même Taskfile.
- Perd le typage bout-en-bout automatique de Drizzle (`schema.ts` unique source de
  vérité) — compensé par le mapper explicite, qui de toute façon est requis en DDD
  strict pour ne pas fuiter le modèle de persistance dans le domaine.
- Migration mentale pour quiconque connaît l'original Drizzle, mais aligné avec le
  choix de framework backend (AdonisJS) déjà acté.
