# ADR-0005 — Endpoint de découverte des méthodes d'auth

## Contexte

Le propriétaire veut PocketID SSO **et** email/password en fallback, avec le backend
qui indique dynamiquement au front ce qui est disponible — extensible plus tard
(passkeys, Google…) sans que le front ait à deviner ou coder en dur une liste de
providers.

## Décision

`GET /api/auth/methods`, public (pas de session requise). Retourne
`{ methods: [{ id, enabled, label }] }`. `id` est un identifiant stable
(`'password' | 'pocketid'`, futur `'passkey' | 'google' | ...`). Le front construit
dynamiquement ses boutons de connexion à partir de cette liste plutôt que de coder
« PocketID toujours visible ».

Backend : `password` toujours présent (activable/désactivable via une variable d'env
`DISABLE_PASSWORD_LOGIN`, comme `arr`) ; `pocketid` présent seulement si
`POCKETID_CLIENT_ID`/`SECRET`/`ISSUER_URL` sont configurés (même logique que
`GetEffectiveAuthSettings` côté `arr`, adaptée : ici c'est statique par env, pas
reconfigurable en base au runtime — pas de UI d'admin pour ça en v1).

## Conséquences

- Ajouter une future méthode d'auth (passkey, Google OIDC) ne casse pas le contrat —
  juste un élément de plus dans le tableau.
- Contrairement à `arr`, pas de hot-reload de la config OIDC depuis une table de
  settings en base (pas de UI d'admin instance-level en v1) — la config PocketID est
  figée par variable d'env au boot. Simplification assumée, cohérente avec l'absence
  de plugin `admin` (ADR-0004).
