# ADR-0002 — Structure en couches identique à `arr`

## Contexte

Le workflow de cadrage impose `src/{domain,application,infrastructure}` côté backend,
`+presentation` côté frontend, en DDD strict. `arr` a déjà rodé une convention de
nommage précise sur cette structure (voir son ADR-0002) : `*.entity.ts`, `*.vo.ts`,
`*.aggregate.ts` en domaine ; `*.use-case.ts` en application ; `*.lucid.ts` +
`*.repository.ts` + `*.mapper.ts` en infrastructure ; `*.controller.ts` + `*.routes.ts`
+ `*.dto.ts` + `*.validator.ts` en présentation. Un provider Adonis par bounded context
fait les bindings DI (interface de domaine → implémentation d'infra).

## Décision

Reprendre cette convention à l'identique pour fridge-ai plutôt que d'en inventer une
nouvelle — même lint de frontière (`dependency-cruiser` + `eslint-plugin-boundaries`,
config commune à la racine étendue par chaque package).

## Conséquences

- Zéro coût de conception sur ce point, cohérence immédiate pour quiconque connaît
  `arr`.
- `app/models` (répertoire Adonis conventionnel) reste vide — c'est volontaire, pas un
  oubli : les modèles Lucid vivent sous `src/infrastructure/persistence/`, jamais
  accédés en dehors de leur repository.
- Le lint de frontière doit être configuré dès la Phase 1 (pas après-coup) pour que la
  règle soit appliquée dès le premier commit de code.
