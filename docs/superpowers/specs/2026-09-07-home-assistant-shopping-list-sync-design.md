# Synchronisation Home Assistant de la liste de courses — Design

**Statut:** proposé (2026-09-07)

## Contexte

Le foyer peut déjà tenir une liste de courses dans fridge-ai (`shopping-list`, CRUD complet côté backend et mobile). Beaucoup de foyers auto-hébergent aussi Home Assistant, où la même liste existe une seconde fois sous la forme d'une entité `todo.*` — alimentée à la voix, depuis un dashboard mural, ou par une intégration tierce (Mealie, Bring!). Les deux listes divergent immédiatement et personne ne gagne.

Ce design lie **une** entité `todo.*` de Home Assistant à la liste de courses d'**un** foyer, dans le sens que le foyer choisit, et donne au propriétaire du foyer un écran pour la configurer : URL de l'instance, jeton d'accès longue durée, découverte et recherche des entités `todo.*` disponibles.

C'est aussi le premier secret que ce projet stocke au repos — dette explicitement signalée par l'ADR-0007 (« chiffrement au repos à traiter »). Ce design la solde.

### Décisions prises en amont

| Question | Décision |
|---|---|
| Qui appelle Home Assistant | Le **backend**. Le jeton est chiffré en base, la liaison est une propriété du foyer, pas de l'appareil. |
| Sens de synchronisation | **Au choix du foyer** : `two_way` (défaut), `push`, `pull`. |
| Périmètre v1 | **`todo.*` uniquement**, une entité liée à la liste de courses. Pas de recettes, pas de garde-manger, pas de table de policies générique. |
| Déclenchement | **Write-through** sur les écritures locales + **réconciliation explicite** au pull-to-refresh. Pas de job de fond. |
| Secret au repos | **Clé dédiée** (`ENCRYPTION_KEY`), pas l'`APP_KEY` d'AdonisJS. |
| Écran | Route Expo Router à part, en `presentation: 'modal'`. |
| Échec d'une écriture poussée | **Best-effort**, réparé par la réconciliation suivante. Pas d'outbox. |

## 1. Contexte borné `home-assistant`

Nouveau contexte borné, **scopé par foyer**. Il ne rejoint pas `settings`, qui est instance-wide par l'ADR-0007 : la liaison Home Assistant est une préférence de foyer, ce que `settings` a explicitement choisi de ne pas être.

```
domain/home-assistant/
  home-assistant-link.aggregate.ts
  instance-url.vo.ts
  sync-direction.vo.ts
  todo-entity.ts                       (read model)
  todo-item.ts                         (read model)
  interfaces/home-assistant-link-repository.interface.ts
  interfaces/home-assistant-client.interface.ts
  interfaces/host-policy.interface.ts
domain/shared/
  encryption.interface.ts
```

### `HomeAssistantLink` (agrégat)

```ts
interface HomeAssistantLinkProps {
  householdId: string
  instanceUrl: InstanceUrl
  token: string            // en clair en mémoire — voir §2
  todoEntityId: string | null
  direction: SyncDirection
  enabled: boolean
  lastSyncAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
```

Méthodes : `updateConnection(url, token, now)`, `bindList(entityId, now)`, `changeDirection(direction, now)`, `setEnabled(enabled, now)`, `recordSync(now)` (pose `lastSyncAt`, efface `lastError`), `recordFailure(message, now)`.

L'agrégat porte le jeton **en clair**. Le chiffrement est une préoccupation du mapper (§2) : le domaine ignore qu'un chiffré existe, et ses tests n'ont besoin d'aucune clé.

`recordFailure` tronque le message à 500 caractères et ne journalise jamais le jeton ni les en-têtes de la requête.

### `InstanceUrl` (VO)

`create(raw)` retourne `Result<InstanceUrl, ValidationError>`. Valide : URL parseable, schéma `http` ou `https` uniquement, aucun identifiant embarqué (`user:pass@`), pas de fragment. Normalise : slash final retiré. Le port est conservé tel quel (`:8123` est le cas nominal).

La VO ne connaît **pas** l'allowlist — c'est une politique de déploiement, pas une règle de domaine (§7).

### `SyncDirection` (VO)

Même forme que `shopping-item-source.vo.ts` : valide `'push' | 'pull' | 'two_way'`, `Result.err` sinon.

### `HomeAssistantClient` (port)

```ts
interface HomeAssistantConnection { instanceUrl: string; token: string }

interface HomeAssistantClient {
  ping(connection): Promise<Result<void, HomeAssistantError>>
  listTodoEntities(connection): Promise<Result<TodoEntity[], HomeAssistantError>>
  listItems(connection, entityId): Promise<Result<TodoItem[], HomeAssistantError>>
  addItem(connection, entityId, item: { summary; description }): Promise<Result<void, HomeAssistantError>>
  updateItem(connection, entityId, uid, patch: { summary?; description?; status? }): Promise<Result<void, HomeAssistantError>>
  removeItem(connection, entityId, uid): Promise<Result<void, HomeAssistantError>>
}

type HomeAssistantError = 'unreachable' | 'unauthorized' | 'entity_not_found' | 'unexpected_response'
```

Les quatre erreurs sont distinctes parce que l'écran en fait quatre phrases différentes (§8). Les replier en une seule rendrait l'écran incapable de dire à l'utilisateur ce qu'il doit corriger.

Read models :

```ts
interface TodoEntity { entityId: string; friendlyName: string }
interface TodoItem { uid: string; summary: string; description: string | null; status: 'needs_action' | 'completed' }
```

## 2. Chiffrement au repos

```ts
// domain/shared/encryption.interface.ts
interface Encryption {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string   // lève si l'authentification échoue
}
```

Implémentation : `infrastructure/shared/aes-gcm-encryption.ts`, AES-256-GCM, clé lue depuis `ENCRYPTION_KEY` (32 octets en base64). Format stocké : `v1.<iv b64>.<tag b64>.<chiffré b64>` — le préfixe de version rend une rotation d'algorithme possible sans deviner le format des lignes existantes.

Le chiffrement/déchiffrement a lieu dans `infrastructure/database/home-assistant/home-assistant-link.mapper.ts`, aux deux bords :

- `toDomain(row)` déchiffre `encrypted_token` vers `props.token`
- `toPersistence(link)` chiffre `link.token` vers `encrypted_token`

Un jeton dont le déchiffrement échoue (clé changée, ligne corrompue) fait échouer la lecture du lien avec une erreur explicite `link_unreadable`, et l'écran propose de ressaisir la connexion. Il ne se dégrade **pas** silencieusement en « pas de lien configuré », ce qui ferait disparaître une configuration existante sans le dire.

Pourquoi une clé dédiée et pas l'`APP_KEY` d'AdonisJS : l'`APP_KEY` signe aussi les sessions et les cookies. Faire tourner l'`APP_KEY` pour invalider les sessions ne doit pas casser silencieusement la liaison Home Assistant de tous les foyers. Cette clé portera aussi les secrets à venir — notamment les clés API par foyer que l'ADR-0007 a reportées.

**Env :** `ENCRYPTION_KEY` est **requis** au boot dès que le contexte `home-assistant` est enregistré. À ajouter à `.env.example`, à `task setup` (génération d'une clé aléatoire, comme l'`APP_KEY`), et au job `check` de la CI — la CI a déjà cassé une fois sur une variable nouvellement requise (commit `0fe7a52`, `NETWORK_URL`), il faut traiter les trois emplacements dans le même changement.

## 3. Schéma base de données

### `1785200000012_create_home_assistant_link_table`

| Colonne | Type | Notes |
|---|---|---|
| `id` | string, PK | |
| `household_id` | string, **unique**, FK → `household` on delete cascade | un lien par foyer |
| `instance_url` | string | normalisée |
| `encrypted_token` | text | §2 |
| `todo_entity_id` | string, nullable | null tant que la liste n'est pas choisie |
| `direction` | string, défaut `'two_way'` | |
| `enabled` | boolean, défaut `true` | |
| `last_sync_at` | timestamp, nullable | |
| `last_error` | string(500), nullable | |
| `created_at`, `updated_at` | timestamp | |

### `1785200000013_add_ha_columns_to_shopping_item_table`

| Colonne | Type | Notes |
|---|---|---|
| `ha_uid` | string, nullable, indexé | uid de l'item côté Home Assistant |
| `ha_synced_at` | timestamp, nullable | dernier instant où la ligne correspondait à Home Assistant |

`ShoppingItem` gagne les getters `haUid` / `haSyncedAt` et une méthode `markSynced(uid, now)`. Sa signature `create()` est inchangée : un item créé localement naît sans uid.

## 4. Réconciliation

`application/home-assistant/sync-shopping-list.use-case.ts` — use case (invoqué par une route, retourne un `Result` que le contrôleur sérialise). Dépend de `HomeAssistantLinkRepository`, `ShoppingItemRepository`, `HomeAssistantClient`, `HostPolicy`, `Clock`.

Il vit dans le contexte `home-assistant`, jamais l'inverse : `shopping-list` ignore qu'il est miroité.

### Détection du « sale »

Home Assistant n'expose **aucun horodatage** sur les items `todo` — seulement `uid`, `summary`, `description`, `status`. Un last-write-wins par comparaison de timestamps est donc impossible. Règle retenue, qui n'a besoin que des deux colonnes du §3 :

> un item est **sale localement** ssi `updated_at > ha_synced_at` (un `ha_synced_at` nul compte comme sale).

Conflit des deux côtés : le local gagne, par construction.

### Correspondance des champs

| fridge-ai | Home Assistant |
|---|---|
| `name` | `summary` |
| `quantity` (`{ amount, unit }`) | `description`, rendu `"2 L"` |
| `checked` | `status: 'completed'` / `'needs_action'` |

La quantité est le bord avec perte : Home Assistant n'a pas de notion de quantité et l'utilisateur écrit ce qu'il veut dans `description`. À l'import, `description` est parsée en `Quantity` si elle a la forme `<nombre> <unité>` ; sinon la valeur par défaut de la VO s'applique et la description brute est ignorée. Assumé : `description` est un champ de fridge-ai, best-effort au retour.

### Adoption des uid

`todo.add_item` ne retourne rien — pas d'uid. Un item poussé ne peut donc pas apprendre son uid au moment de la poussée. L'adoption a lieu dans la réconciliation : tout item local dont `ha_uid` est nul est apparié aux items Home Assistant sans propriétaire local, **par `summary` normalisé** (trim, casefold, espaces réduits). Apparié → l'uid est adopté.

Ce n'est pas un contournement : c'est aussi l'étape qui joint deux listes préexistantes la première fois qu'on les lie. Une ambiguïté (deux items du même nom) est résolue par ordre stable et laissée telle quelle — le pire cas est un appariement croisé entre deux lignes de contenu identique, sans perte.

### Matrice par sens

| Situation | `push` | `pull` | `two_way` |
|---|---|---|---|
| uid connu, sale localement | `update_item` | écrase le local depuis HA | `update_item` |
| uid connu, propre localement | `update_item` | adopte l'état HA | adopte l'état HA |
| uid connu, item disparu de HA | ré-ajoute dans HA | supprime en local | supprime en local |
| pas d'uid, un item HA du même nom | adopte l'uid | adopte l'uid | adopte l'uid |
| pas d'uid, aucune correspondance | `add_item` | reste local, jamais poussé | `add_item` |
| item HA sans propriétaire local | laissé intact | importé en local | importé en local |

Deux cases délibérément non symétriques, toutes deux pour ne pas détruire des données que personne n'a demandé de toucher :

- **`push` ne supprime jamais dans Home Assistant** ce qu'il n'y a pas créé. Une liste `todo` peut contenir des items d'un assistant vocal ou d'une autre intégration ; « fridge-ai fait foi » parle de *nos* items, ce n'est pas un permis de vider la liste de quelqu'un.
- **`pull` ne supprime jamais les items purement locaux.** Ils restent simplement non miroités.

Une case **est** destructrice, par conception : en `push`, un item supprimé dans Home Assistant est ré-ajouté. C'est ce que « fridge-ai fait foi » signifie, et l'écran le dit en toutes lettres (§8).

Un item importé depuis Home Assistant est créé avec `source = 'manual'`.

### Transaction et erreurs

Toute ligne touchée reçoit `ha_synced_at = now`. En fin de passe : `link.recordSync(now)`. Toute erreur du client interrompt la réconciliation entière et pose `link.recordFailure(message, now)` — pas de suppression à moitié appliquée sur un hôte instable.

La réconciliation est un no-op immédiat si le lien est absent, `enabled === false`, ou `todoEntityId === null`.

## 5. `ShoppingListMirror` (service, pas use case)

`application/home-assistant/shopping-list-mirror.ts`.

```ts
export class ShoppingListMirror {
  constructor(links, client, hostPolicy, clock) {}
  async itemCreated(item: ShoppingItem): Promise<void>
  async itemUpdated(item: ShoppingItem): Promise<void>
  async itemDeleted(householdId: string, haUid: string | null): Promise<void>
}
```

Ce n'est pas un use case et il n'implémente pas `UseCase<In, Out>` : il n'a pas d'`execute` unique, il ne retourne rien qu'un appelant puisse exploiter, et il avale ses propres erreurs. Les trois points du contrat manquent.

Comportement : no-op si le foyer n'a pas de lien, si `enabled === false`, si `todoEntityId` est nul, **ou si `direction === 'pull'`** (en mode pull une écriture locale ne doit jamais atteindre Home Assistant). Sinon : appel du client avec un timeout de 2 s, capture de toute erreur, `link.recordFailure(...)`, jamais de `throw`.

`itemCreated` n'essaie pas d'apprendre l'uid (§4) — la réconciliation suivante l'adopte.

Enregistré en singleton `homeAssistant.shoppingListMirror` dans un nouveau `providers/home_assistant_provider.ts`. `presentation/shopping-list/shopping-item.controller.ts` l'attend **après** que l'écriture locale a réussi, et ne modifie jamais sa réponse en fonction du résultat. `create-shopping-item.use-case.ts` et ses voisins ne changent pas : un miroir en échec ne fait explicitement pas partie du contrat de l'écriture.

## 6. API HTTP

`presentation/home-assistant/` : `ha-link.controller.ts`, `ha-link.routes.ts`, `ha-link.dto.ts`, `ha-link.validator.ts`.

| Route | Accès | Effet |
|---|---|---|
| `GET /api/settings/home-assistant` | membre du foyer | état du lien, **jamais** le jeton |
| `PUT /api/settings/home-assistant` | owner | pose URL + jeton ; `ping` avant d'écrire, `422` si le ping échoue |
| `POST /api/settings/home-assistant/discover` | owner | liste les entités `todo.*` ; le corps peut porter `{ instanceUrl, token }` en ligne, pour tester avant tout stockage |
| `PATCH /api/settings/home-assistant` | owner | `todoEntityId`, `direction`, `enabled` |
| `DELETE /api/settings/home-assistant` | owner | supprime le lien et remet à null `ha_uid` / `ha_synced_at` sur les items du foyer |
| `POST /api/shopping-items/sync` | membre du foyer | lance la réconciliation |

Les six routes sont déclarées dans `ha-link.routes.ts`, y compris la dernière : son chemin est sous `/api/shopping-items` parce que c'est ce que l'appelant synchronise, mais le code appartient au contexte `home-assistant` — `shopping-list` continue d'ignorer qu'il est miroité.

Le contrôle owner réutilise mot pour mot le motif de `set-active-ai-provider.use-case.ts` : `households.findByUserId(userId)`, `ownerId !== userId` → `Result.err('not_owner')` → `403`.

DTO retourné :

```ts
{
  configured: boolean
  instanceUrl: string | null
  tokenSet: boolean
  todoEntityId: string | null
  todoEntityName: string | null
  direction: 'push' | 'pull' | 'two_way'
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
}
```

Le jeton est en écriture seule : il entre, il ne ressort jamais. Un `PUT` avec un jeton vide **conserve** le jeton stocké, pour que le propriétaire puisse corriger l'URL sans le recoller.

Codes d'erreur : `403 not_owner`, `422 invalid_url`, `422 host_not_allowed`, `422 unreachable`, `422 unauthorized`, `422 entity_not_found`, `404 link_not_found`, `409 link_unreadable` (jeton indéchiffrable, §2).

Endpoints Home Assistant consommés par `infrastructure/home-assistant/http-home-assistant.client.ts`, en-tête `Authorization: Bearer <token>` :

- `GET /api/` — ping
- `GET /api/states` — découverte, filtrée sur `entity_id` commençant par `todo.`, libellé pris dans `attributes.friendly_name`
- `POST /api/services/todo/get_items?return_response` — lecture des items (Home Assistant ≥ 2023.12)
- `POST /api/services/todo/add_item`, `update_item`, `remove_item`

Client : timeout 5 s, `redirect: 'manual'`, plafond de taille de réponse, et aucune journalisation du corps des requêtes sortantes.

## 7. Sécurité

Cette fonctionnalité est, par nature, un backend qui appelle une URL saisie par l'utilisateur — un SSRF assumé. La cible correcte est presque toujours privée (`http://homeassistant.local:8123`, `http://192.168.1.x`), donc la parade habituelle (bloquer les plages privées) bloquerait la seule configuration qui fonctionne.

Position retenue :

- `http`/`https` seulement, aucun autre schéma, aucun identifiant dans l'URL, aucune redirection suivie
- réservé aux **owners** de foyer, qui sur une instance auto-hébergée sont déjà de confiance vis-à-vis du déploiement
- les réponses ne sont jamais renvoyées telles quelles au client : la découverte ne retourne que `entity_id` et `friendly_name` des entités `todo.*`. Le mécanisme ne peut donc pas servir de scanner de ports généraliste ni de lecteur de contenu
- **allowlist optionnelle** : `HOME_ASSISTANT_ALLOWED_HOSTS`, liste d'`hôte` ou `hôte:port` séparés par des virgules. Vide ou absente = tout est autorisé, pour que les déploiements existants et `task setup` n'aient rien à changer.

L'allowlist passe par un port, pas par une lecture d'env dans un use case :

```ts
// domain/home-assistant/interfaces/host-policy.interface.ts
interface HostPolicy { isAllowed(url: InstanceUrl): boolean }
```

Implémenté par `infrastructure/home-assistant/env-host-policy.ts`, même forme que `EnvAiSettingsProvider`. `SaveHomeAssistantConnection` et `DiscoverTodoEntities` le consultent et retournent `'host_not_allowed'` → `422`. Les tests reçoivent une politique factice, sans manipuler d'env.

**Risque résiduel accepté et documenté :** un owner peut faire émettre au backend des requêtes vers n'importe quel hôte joignable et apprendre s'il s'y trouve quelque chose qui ressemble à un Home Assistant. `HOME_ASSISTANT_ALLOWED_HOSTS` est l'échappatoire de l'opérateur qui refuse ce risque.

## 8. Mobile

### Route

`src/app/home-assistant.tsx` — à plat, voisine de `household.tsx` et `settings.tsx`, déclarée dans le `Stack` racine par `<Stack.Screen name="home-assistant" options={{ presentation: 'modal' }} />`. C'est le mécanisme que `src/app/receipts/_layout.tsx` utilise déjà pour l'écran de scan : la présentation modale est un précédent du projet, pas une invention. `stack-routes.test.tsx` gagne un cas.

### Écran

`src/presentation/home-assistant/home-assistant-screen.tsx`, deux états pilotés par une variable `step`, initialisée selon qu'une connexion existe déjà.

**État 1 — Connexion.** Deux `AuthField` (URL de l'instance, jeton longue durée) dans un `FormCard`, et un `PillButton` « Tester la connexion » qui appelle `POST /discover` avec les identifiants en ligne. Un seul appel prouve le jeton **et** ramène la liste : pas de bouton de test qui réussit suivi d'une découverte qui échoue. Chaque erreur est une phrase distincte, jamais un échec générique :

| Erreur | Phrase |
|---|---|
| `unreachable` | « Impossible de joindre cette adresse depuis le serveur. » |
| `unauthorized` | « Home Assistant a refusé ce jeton. » |
| `host_not_allowed` | « Cet hôte n'est pas autorisé sur ce serveur. » |
| `invalid_url` | « Cette adresse n'est pas valide. » |
| liste vide | « Aucune liste `todo` sur cette instance. » |

**État 2 — Liste.** `TodoEntityPicker` : un `Input` de recherche filtrant sur le nom convivial et l'`entity_id`, des lignes en sélection unique. En dessous :

- un groupe de `Chip` pour le sens — même composant et même motif que le sélecteur de fournisseur IA de `settings-screen.tsx`, pour que ça se lise comme le même genre de contrôle. Explication d'une ligne qui change avec la sélection :
  - **Deux sens** (défaut) — « Les ajouts faits ici et dans Home Assistant se retrouvent des deux côtés. »
  - **Vers Home Assistant** — « Home Assistant reflète cette liste. Un article supprimé là-bas revient. »
  - **Depuis Home Assistant** — « Cette liste suit Home Assistant. Tes modifications ici seront écrasées. »
- un interrupteur `enabled`
- la ligne de dernière synchro — « Dernière synchro il y a 3 min », ou `lastError` en `palette.expiredText`
- un lien texte « Modifier la connexion » qui ramène à l'état 1
- « Délier », derrière l'`ActionSheet` de confirmation destructive, comme la déconnexion

Ouvrir un foyer déjà configuré arrive directement sur l'état 2. Enregistrer la liaison est un `PATCH`, puis `router.back()`.

### Point d'entrée

Une section « Maison connectée » dans `settings-screen.tsx`, entre le bloc IA et la déconnexion, avec une explication d'une ligne dans la voix déjà en place (« Garde ta liste de courses en phase avec Home Assistant. ») et une ligne montrant l'entité liée ou « Non configuré ».

Rendue **uniquement si `household.data.role === 'owner'`** : on ne montre pas à un membre une porte qui répondra `403`.

### Liste de courses

Le `usePullToRefresh` de `shopping-list-screen.tsx` gagne une première étape : `POST /api/shopping-items/sync`, puis l'invalidation existante. Un échec de synchro ne doit pas avaler le rafraîchissement — les items se rechargent depuis le local, et l'échec apparaît en ligne discrète, pas en erreur bloquante.

### Plomberie

- `src/domain/home-assistant/ha-link.ts` — types
- `src/application/home-assistant/` — `ha-link.query.ts`, `discover-todo-entities.mutation.ts`, `save-connection.mutation.ts`, `bind-list.mutation.ts`, `unlink.mutation.ts`, `sync-shopping-list.mutation.ts`, via `defineQuery` / `defineMutation`
- nouvelles méthodes de connecteur sur `http-fridge-connector.ts`, plus `src/infrastructure/fake/fixtures/home-assistant.fixture.ts` pour que le connecteur factice garde la parité

## 9. Tests

**Domaine.** `InstanceUrl` (schémas refusés, identifiants embarqués, normalisation du slash), `SyncDirection`, transitions de `HomeAssistantLink` (`recordFailure` tronque et efface au `recordSync` suivant).

**Chiffrement.** Aller-retour, chiffrés distincts pour un même clair (IV aléatoire), déchiffrement d'un chiffré altéré qui lève.

**Use cases**, avec un `HomeAssistantClient` factice et une `HostPolicy` factice : refus non-owner sur les quatre routes owner (`PUT`, `/discover`, `PATCH`, `DELETE`), `host_not_allowed`, `PUT` à jeton vide qui conserve le jeton, `DELETE` qui remet à null les colonnes des items.

**Réconciliation** — le cœur. Tests tabulaires sur la matrice du §4 : les six situations × les trois sens, plus l'adoption d'uid par nom, plus l'abandon sur erreur du client (aucune suppression appliquée), plus le no-op quand `enabled === false`.

**Miroir.** No-op en `pull`, erreur avalée et enregistrée, l'écriture locale reste réussie.

**Mapper.** Aller-retour chiffrement, et le lien illisible qui remonte `link_unreadable` au lieu de « pas de lien ».

**Mobile.** `home-assistant-screen.test.tsx` sur le modèle de `settings-screen.test.tsx` : les deux états, chaque phrase d'erreur, le filtre de recherche, le changement de sens, l'entrée directe en état 2 quand c'est configuré. `settings-screen.test.tsx` gagne le cas « la section n'apparaît pas pour un membre ».

## 10. ADR à écrire

- **ADR-0012 — Chiffrement des secrets au repos, clé dédiée.** Pourquoi `ENCRYPTION_KEY` plutôt que l'`APP_KEY`, format versionné, ce qui arrive quand la clé est perdue. Solde la dette signalée par l'ADR-0007.
- **ADR-0013 — Intégration Home Assistant, scopée par foyer.** Pourquoi un contexte borné à part et non une extension de `settings` (qui est instance-wide par l'ADR-0007) ; appels côté backend ; SSRF assumé et son allowlist ; miroir best-effort sans outbox ; sens de synchro laissé au foyer et les deux asymétries volontaires de la matrice.

## Hors scope

- Recettes et garde-manger. Home Assistant n'a pas de concept de recette (seulement les intégrations Mealie/Tandoor, qui ressortent en `todo.*` et `calendar.*`), et pousser un plan de repas supposerait une notion de « prévu pour jeudi » que le contexte `recipe` n'a pas — il n'a que `cook`.
- Plus d'une liste liée par foyer.
- Synchronisation de fond planifiée. Il n'y a pas d'ordonnanceur dans `compose.yml`, et le pull-to-refresh plus le write-through couvrent le cas d'usage.
- Saisie du jeton par membre non-owner, et jetons par appareil.
- Découverte automatique de l'instance Home Assistant (mDNS).
