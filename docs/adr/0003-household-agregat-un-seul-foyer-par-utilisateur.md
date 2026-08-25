# ADR-0003 — `Household` comme agrégat, un seul foyer par utilisateur en v1

## Contexte

L'original `~/dev/fridge` était strictement mono-utilisateur (`product.userId` direct,
pas de partage). Le propriétaire a demandé un frigo partageable à plusieurs personnes
(foyer) dès le MVP — c'est la décision la plus structurante du cadrage, elle détermine
la clé de scope de tout le reste du domaine.

## Décision

- Nouvel agrégat `Household` (nom, `ownerId`, code d'invitation, membres).
- `HouseholdMember` associe un `userId` à un `householdId` avec un rôle
  (`owner` | `member` — deux valeurs seulement, pas de permissions fines v1).
- **Un utilisateur appartient à au plus un foyer à la fois**, appliqué par une
  contrainte unique en base (`unique(user_id)` sur `household_member`), pas seulement
  en mémoire — pas de multi-foyer, pas de household-switcher.
- Rejoindre se fait par code d'invitation (pas d'email d'invitation — pas
  d'infrastructure d'envoi de mail dans ce projet, et le cas d'usage "foyer" se prête
  bien à un code partagé de vive voix/message).
- Toutes les autres entités (`Product`, `Receipt`, `ShoppingItem`, `Recipe`) sont
  scopées `householdId`, jamais `userId`.

## Conséquences

- Simplifie l'auth : pas de gestion fine de permissions à construire tout de suite.
- Un owner qui veut quitter doit supprimer le foyer (cascade) — pas de transfert de
  propriété v1. Assumé, signalé dans `docs/phase-0/00-overview-et-points-a-valider.md`.
- Si le besoin de multi-foyer (ex. colocation temporaire + famille) émerge plus tard,
  ça demande de lever la contrainte unique et d'ajouter un household-switcher côté
  app — migration non triviale mais pas bloquante, contenue par la contrainte
  explicite plutôt que par une hypothèse implicite non vérifiée.
