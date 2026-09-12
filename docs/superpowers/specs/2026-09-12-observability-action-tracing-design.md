# Traçage des actions (back + front) — Design

**Statut:** approuvé (2026-09-12)

## Contexte

L'infrastructure d'observabilité (collector OTel, NodeSDK backend avec auto-instrumentation HTTP/PG/undici/Pino, client OTLP mobile maison avec relai via le backend, redaction) est déjà en place et fonctionne correctement. Elle ne couvre cependant que le transport (une requête HTTP = un span générique nommé `POST /api/products`) — rien au niveau métier. Constat après lecture du code :

- **Backend** : sur 10 controllers, un seul (`receipt.controller.ts`) log explicitement, et seulement sur deux cas d'erreur ponctuels. Les use-cases (`execute()`) n'émettent jamais rien. Impossible de répondre à "qui a fait quoi, sur quel produit/recette/item, avec quel résultat" à partir des logs/traces actuels — seule la route HTTP et son status code sont visibles.
- **Mobile** : le client télémétrie (`telemetry.ts`, spans + logs OTLP, correlation `traceparent`) n'est utilisé que dans la couche HTTP (`http-client.ts`, `http-fridge-connector.ts`). 12 fichiers applicatifs/présentation ont des `catch` jamais branchés sur `recordError`. Un bug plus grave : `tracedFetch` ne marque le span en échec que sur exception réseau — une réponse HTTP d'erreur (404/422/500, `!response.ok`) termine le span comme un succès.

Ce spec couvre le traçage de toute action déclenchée par l'utilisateur — lectures incluses, pas seulement les écritures — avec un contexte suffisant pour identifier qui a fait quoi, sur quelle entité, avec quel résultat.

Décisions déjà validées en amont (brainstorming) :
- Périmètre : toutes les actions, lectures comprises.
- Mécanisme : wrapper générique appliqué au point de passage unique déjà existant de chaque côté (pas de log à la main dispersé dans chaque use-case/écran).
- Contexte minimum par action : qui (userId), quoi (nom d'action + use-case exécuté), sur quoi (entityId), où (householdId), résultat + durée.

## 1. Convention — ce que porte une action tracée

Chaque action loggée porte le même jeu de champs des deux côtés, pour rester filtrable de façon identique en base+mobile :

| Champ | Contenu | Backend | Mobile |
|---|---|---|---|
| `action` | Étiquette stable `<domaine>.<verbe_nom>` (ex. `fridge.create_product`) | dérivée de `domain` + kebab-case du nom de la UseCase | passée explicitement par site d'appel dans `http-fridge-connector.ts` |
| `useCase` | Nom exact de la classe UseCase exécutée | `CreateProduct.name` (jamais tapé à la main) | — (pas de UseCase côté mobile ; `action` suffit) |
| `userId` | Utilisateur authentifié | `ctx.authenticatedUser?.id` | non disponible côté client sans plomberie supplémentaire — **hors scope**, voir §8 |
| `householdId` | Foyer courant | `ctx.household?.id` | déjà présent dans la plupart des payloads d'entrée des mutations — passé explicitement |
| `entityId` | Entité ciblée | `ctx.params.id` (gratuit sur show/update/destroy) ou `opts.entityId(result)` (create) | argument déjà connu au site d'appel (`productId`, `recipeId`, ...) |
| `durationMs` | Durée de l'action | mesurée dans le wrapper | déjà produite par le span existant |
| `outcome` | `success` \| `error` | dérivé de l'exception ou de `opts.isError(result)` | dérivé de `response.ok` / exception réseau |
| `errorType` | Nom du type d'erreur, uniquement si `outcome: 'error'` | `error.constructor.name` | `ApiError.type` ou `error.name` |

Jamais de payload brut (texte libre, nom de produit, notes, email) dans ces attributs — seulement des identifiants et des énumérations, cohérent avec la convention déjà en place dans `receipt.controller.ts` (`logger.warn({ champs choisis }, message)`, jamais de dump).

## 2. Backend — `traceAction`

Nouveau fichier `backend/src/presentation/shared/trace-action.ts` :

```ts
import type { HttpContext } from '@adonisjs/core/http'

export async function traceAction<T>(
  ctx: HttpContext,
  domain: string,
  useCase: { name: string },
  fn: () => Promise<T>,
  opts?: { isError?: (result: T) => boolean; entityId?: (result: T) => string | undefined },
): Promise<T> {
  const startedAt = performance.now()
  const action = `${domain}.${toSnakeCase(useCase.name)}`
  const base = {
    action,
    useCase: useCase.name,
    userId: ctx.authenticatedUser?.id,
    householdId: ctx.household?.id,
    entityId: ctx.params.id as string | undefined,
  }

  try {
    const result = await fn()
    const failed = opts?.isError?.(result) ?? false
    ctx.logger[failed ? 'warn' : 'info'](
      {
        ...base,
        entityId: base.entityId ?? opts?.entityId?.(result),
        durationMs: Math.round(performance.now() - startedAt),
        outcome: failed ? 'error' : 'success',
      },
      `action:${action}`,
    )
    return result
  } catch (error) {
    ctx.logger.error(
      {
        ...base,
        durationMs: Math.round(performance.now() - startedAt),
        outcome: 'error',
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      },
      `action:${action}`,
    )
    throw error
  }
}
```

`toSnakeCase` : petit utilitaire local (`CreateProduct` → `create_product`), pas de dépendance externe.

`ctx.logger` est déjà corrélé `trace_id`/`span_id` par `PinoInstrumentation` (voir `instrumentation.ts`) et mirroré vers le pipeline OTLP logs — aucune nouvelle dépendance, aucun nouveau span.

### Application aux controllers

Chaque méthode de controller enveloppe son corps existant, sans changer sa logique :

```ts
async store(ctx: HttpContext) {
  requireAuthenticatedUser(ctx)
  return traceAction(ctx, 'fridge', CreateProduct, async () => {
    const payload = await ctx.request.validateUsing(createProductValidator)
    const products = await ctx.containerResolver.make('fridge.products')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new CreateProduct(products, idGenerator, clock).execute({
      householdId: ctx.household.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ product: toProductDto(result.value) })
  }, { isError: () => false }) // outcome réel déjà géré : voir note ci-dessous
}
```

Note sur `isError` : `traceAction` ne voit que la valeur de retour de `fn`, pas le `Result` interne du use-case (le controller a déjà géré la branche erreur et renvoyé une réponse JSON). Pour capter les échecs métier (validation, `product_not_found`, etc.) sans changer la forme des controllers, `fn` renvoie explicitement `{ failed: boolean }` en plus de la réponse déjà envoyée — le wrapper n'inspecte que ça :

```ts
return traceAction(ctx, 'fridge', CreateProduct, async () => {
  // ...
  const result = await new CreateProduct(...).execute({ ... })
  if (!result.ok) {
    const { status, body } = serializeError(result.error)
    ctx.response.status(status).json(body)
    return { failed: true }
  }
  ctx.response.status(201).json({ product: toProductDto(result.value) })
  return { failed: false, entityId: result.value.id }
}, { isError: (r) => r.failed, entityId: (r) => r.entityId })
```

Chaque controller adopte cette forme (retour `{ failed, entityId? }` au lieu du retour direct de `ctx.response`) — édition mécanique, même structure sur les ~70 méthodes des 10 controllers. Les méthodes de lecture pure (`index`, `show`, `expiringSoon`) n'ont pas de branche d'erreur métier : `isError` omis, `outcome` toujours `success` sauf exception.

## 3. Mobile — enrichir le span existant

### Nommage + contexte par appel

`tracedFetch`, `apiFetch`, `apiFetchMultipart` (`http-client.ts`) acceptent un 4ᵉ paramètre optionnel :

```ts
interface ActionContext {
  action: string
  attributes?: Record<string, string | number | boolean>
}
```

Fusionné dans les attributs du span déjà créé par `startClientSpan` — pas de nouvelle primitive télémétrie, `telemetry.ts` ne change pas. Si absent, comportement actuel inchangé (`${method} ${path}` comme nom de span) : les rares appels hors `http-fridge-connector.ts` (s'il y en a) ne régressent pas.

`http-fridge-connector.ts` (seul appelant aujourd'hui) passe ce contexte à chaque méthode, ex. :

```ts
async createProduct(input: CreateProductInput) {
  return apiFetch<ProductDto>('/api/products', { method: 'POST', body: JSON.stringify(input) },
    { action: 'fridge.create_product', attributes: { householdId: input.householdId } })
}
```

~30 méthodes, édition mécanique une ligne (ajout du 3ᵉ argument), noms d'action alignés sur la convention backend (`<domaine>.<verbe_nom>`) pour rester corrélables entre les deux logs même sans parent-span commun.

### Fix : span marqué en échec sur réponse HTTP d'erreur

Dans `apiFetch`/`apiFetchMultipart`, après extraction de `body.error` sur `!response.ok` :

```ts
if (!response.ok) {
  const error = body.error as ApiError
  telemetry.recordError(`action failed: ${error.type}`, { attributes: { 'error.type': error.type } })
  if (error.type === 'unauthenticated') handleUnauthenticated()
  return Result.err(error)
}
```

Ne restructure pas le timing du span existant (`tracedFetch` continue de `span?.end(...)` dès la réponse reçue) — ajoute juste l'enregistrement d'erreur en parallèle, réutilisant `recordError` déjà présent et déjà testé (`telemetry.test.ts`).

Les lectures (`listProducts`, etc.) passent par le même chemin — couvertes automatiquement, sans traitement spécial.

## 4. Actions locales sans appel réseau

12 fichiers avec des `catch` non branchés (permission caméra refusée, erreur de picker image, validation locale avant soumission, etc.). Pas de point de passage unique ici — pas d'équivalent à `http-fridge-connector.ts` pour ces échecs, donc édition manuelle site par site :

- Revue des 12 `catch`, un par un, pour ne garder que les échecs réellement significatifs (filtrer les annulations volontaires — `AbortError`, permission déjà refusée et gérée par un état UI dédié — qui ne sont pas des échecs à tracer).
- Sur les sites retenus, `telemetry.recordError(message, { attributes: { action: '<domaine>.<action_locale>' } })`, même convention de nommage que le reste.

La liste précise des 12 sites et lesquels sont retenus est un travail d'implémentation (revue fichier par fichier), pas une décision de design — traité dans le plan d'implémentation.

## 5. Redaction / confidentialité

Aucun changement à `attributes/redact` (collector) ni `logger.redact` (backend) — les nouveaux champs (`action`, `useCase`, `userId`, `householdId`, `entityId`, `durationMs`, `outcome`, `errorType`) ne portent jamais de credential ni de texte libre, donc rien de nouveau à filtrer. Revue explicite au moment de l'implémentation : si un `opts.entityId`/`attributes` finit par exposer autre chose qu'un id ou une énumération (ex. un email dans `identity.sign_up`), le champ est exclu plutôt qu'ajouté à une liste de redaction — même principe que le commentaire déjà présent dans `logger.ts` ("la forme d'un secret est elle-même une information").

## 6. Tests

- Unit `trace-action.ts` : succès → `logger.info` une fois avec `outcome: 'success'` ; exception → `logger.error` + re-throw ; `opts.isError` respecté (retour `{ failed: true }` → `logger.warn`, `outcome: 'error'`) ; `entityId` résolu depuis `ctx.params.id` puis depuis `opts.entityId` en fallback.
- Extension `telemetry.test.ts` (mobile) : `apiFetch` avec réponse `!response.ok` déclenche `recordError` avec le bon `error.type`.
- 2-3 tests ciblés sur les sites de `catch` mobile retenus en §4 (pas exhaustif sur les 12 — seulement ceux jugés significatifs).
- Pas de nouveau test fonctionnel backend par controller : la couverture existante (`tests/functional/*.spec.ts`) continue de vérifier le comportement HTTP inchangé ; `traceAction` est une enveloppe transparente, testée une fois en unit, pas redondée sur chaque route.

## 7. Hors scope

- `userId` côté mobile (nécessiterait de lire la session à chaque site d'appel dans `http-fridge-connector.ts` ; le backend a déjà `userId` via le cookie de session, donc la corrélation utilisateur reste possible côté backend même sans ce champ mobile).
- Dashboards/alertes sur ces nouveaux champs — pas demandé, pas dans ce spec.
- Toute action non déclenchée par une requête HTTP côté backend (jobs, CLI) — aucun de ces chemins n'existe aujourd'hui dans le code lu.
