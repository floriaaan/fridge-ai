# ADR-0007 — Provider IA changeable à chaud, restreint aux owners de foyer

## Contexte

Décision initiale : un seul provider actif, figé par `AI_PROVIDER` au boot, à changer
en redéployant. Le propriétaire veut pouvoir basculer de provider sans redémarrer le
process (ex. passer de Gemini à Ollama local sans coupure de service).

Pas de rôle admin d'instance dans ce projet (ADR-0004) — il faut donc désigner qui a
le droit de changer un réglage qui affecte toute l'instance, pas un foyer en
particulier.

## Décision

Reprend le pattern de hot-reload d'`arr` (`AuthSettingsProvider` /
`getAuthInstance`, cache invalidé par changement de signature) appliqué au choix du
provider IA :

- Nouveau bounded context `settings` (instance-wide, **pas** scopé `householdId` —
  seule exception à la règle générale de scope par foyer, documentée ici explicitement).
- `AiProviderSettings` : ligne singleton en base (`ai_provider_setting`), stocke le
  provider actif (`gemini | openai | ollama`). `AiSettingsProvider.resolveEffective()`
  fusionne cette valeur avec le défaut `AI_PROVIDER` de l'env si aucune ligne
  n'existe encore (comportement identique au premier boot).
- `ai-provider-registry.ts` résout et cache l'adapter actif, invalide son cache dès
  que la signature de la config effective change (lecture DB bon marché à chaque
  appel, pas de rebuild de l'adapter à chaque requête).
- `GET /api/settings/ai` — lecture, toute session valide. Retourne le provider actif,
  sa source (`database` | `environment`), et la liste des providers réellement
  utilisables (ceux dont les credentials sont présents en env).
- `PATCH /api/settings/ai` — écriture, restreint aux **owners de foyer** (n'importe
  lequel, pas un rôle spécifique à ce réglage — faute d'un concept d'instance-admin
  distinct, cf. ADR-0004). `422` si le provider demandé n'a pas ses credentials
  configurés en env.

## Conséquences

- N'importe quel owner peut changer le provider actif pour **toute l'instance**, pas
  seulement pour son propre foyer — assumé : c'est un réglage d'infra/clés API
  partagées, pas une préférence par foyer. Sur une instance à plusieurs foyers
  indépendants, ça suppose une confiance mutuelle entre owners ; si ce n'est pas
  souhaitable, il faudra réintroduire une notion d'instance-admin (contredit
  ADR-0004) — signalé, pas tranché ici.
- Changer le provider ne permet pas de saisir une nouvelle clé API depuis l'app —
  seulement de basculer parmi les providers déjà crédentialés en env au boot. Éditer
  les clés API depuis l'app est une extension distincte (chiffrement au repos à
  traiter, cf. `arr` → `infrastructure/shared/encryption.ts`).
- `AI_PROVIDER` en env devient un défaut de secours (premier boot, avant toute
  écriture en base), plus la seule source de vérité.
