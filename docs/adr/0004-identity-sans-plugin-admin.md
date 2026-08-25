# ADR-0004 — Tables identity better-auth sans plugin `admin`

## Contexte

`arr` utilise le plugin `admin` de better-auth pour un rôle global d'administration de
l'instance (colonnes `role`/`banned`/`ban_reason`/`ban_expires` sur `user`,
`impersonated_by` sur `session`). fridge-ai n'a pas cette notion de rôle global —
l'app entière tourne au niveau du foyer, pas d'un admin d'instance.

## Décision

Pas de plugin `admin` better-auth. Les rôles applicatifs (`owner`/`member`) sont
portés par `household_member`, pas par better-auth. Les tables `user`/`session`
identity sont donc plus fines que celles d'`arr` (pas de colonnes admin-plugin).

## Conséquences

- Une table `user` plus simple, moins de champs morts.
- Si un besoin d'administration globale d'instance apparaît (ex. modération multi-
  foyers sur une instance publique), il faudra ajouter le plugin après-coup —
  migration additive, pas de conflit avec le choix actuel.
