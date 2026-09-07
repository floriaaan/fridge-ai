# Observabilité — faire tourner, vérifier, exploiter

Décision et justifications : `docs/adr/0011`. Ce document-ci est opérationnel.

## Architecture

```
  App mobile (Expo)                          Backend (AdonisJS)
  ─────────────────                          ──────────────────
  apiFetch()                                 instrumentation.js (--import)
    │  span client                             │  HTTP entrant  (instrumentation-http)
    │  header traceparent  ───────────────▶    │  fetch sortant (instrumentation-undici)
    │                                          │  PostgreSQL    (instrumentation-pg)
    │  batch OTLP/JSON toutes les 15 s         │  logs pino     (instrumentation-pino)
    ▼                                          │  runtime Node  (instrumentation-runtime-node)
  POST /api/telemetry/v1/{traces,logs}         │
    │  quota + plafond de taille + liste       │ OTLP/HTTP (proto)
    │  blanche d'attributs + pseudonymisation  │
    └──────────────┐              ┌────────────┘
                   ▼              ▼
              OpenTelemetry Collector          :4317 gRPC / :4318 HTTP (loopback)
                   │  memory_limiter → filter → redaction → batch
                   │  spanmetrics (métriques RED dérivées des spans)
                   │  file d'attente sur disque + retry
                   ▼
              OpenObserve                      :5080 UI + API (loopback)
                   logs · traces · métriques, rétention 30 j
```

Le `traceparent` du mobile est la totalité du mécanisme de corrélation : le backend
continue la trace au lieu d'en ouvrir une nouvelle, donc `GET /api/recipes` depuis le
téléphone, le span HTTP serveur, les spans PostgreSQL et l'appel sortant au fournisseur
d'IA portent tous le même `trace_id`.

## Démarrer

```bash
cp -n .env.example .env            # puis changer OPENOBSERVE_ROOT_PASSWORD
task up                            # db + backend + otel-collector + openobserve
open http://127.0.0.1:5080         # identifiants = OPENOBSERVE_ROOT_*
```

Sans l'observabilité :

```bash
task up:app-only                   # db + backend uniquement
task obs:down                      # ou : arrêter les deux conteneurs à chaud
```

En développement (`task dev`, backend sur l'hôte) : le script `dev` charge déjà
`--import ./instrumentation.js`. Il faut que `backend/.env` contienne les variables
`OTEL_*` / `TELEMETRY_*` de `backend/.env.example` — un `.env` déjà existant n'est pas
mis à jour par `task setup` (`cp -n`), donc ces lignes sont à recopier à la main. Le
Collector, lui, écoute sur `127.0.0.1:4318` dès que `task up` a tourné.

### Changer les identifiants OpenObserve

Le Collector s'authentifie en Basic auth avec les mêmes identifiants :

```bash
echo -n "vous@example.com:votre-mot-de-passe" | base64   # → OTLP_STORE_AUTH
```

`OPENOBSERVE_ROOT_EMAIL`, `OPENOBSERVE_ROOT_PASSWORD` et `OTLP_STORE_AUTH` doivent
rester cohérents. Le mot de passe n'est lu qu'à la création du compte racine : le
changer après coup demande de le changer aussi dans l'UI.

## Vérifier

**1 — Le backend exporte des traces.**

```bash
curl -s http://localhost:3333/api/auth/methods > /dev/null
```

Dans OpenObserve → *Traces*, filtrer sur `service_name = 'fridge-ai-backend'`. La trace
contient le span HTTP serveur et les spans `pg` de la requête. `/health` n'apparaît
jamais : il est filtré côté SDK *et* côté Collector.

**2 — Les logs arrivent et portent le trace_id.**

Dans *Logs*, stream `default`. Chaque ligne émise pendant une requête porte `trace_id`
et `span_id` — c'est `instrumentation-pino` qui les injecte. Un clic mène à la trace.

**3 — Les métriques arrivent.**

Dans *Metrics* : `traces_span_metrics_duration_milliseconds` (dérivées par
`spanmetrics`, donc présentes pour le mobile *et* le backend) et les métriques runtime
Node (`nodejs_eventloop_delay_*`, heap, GC).

**4 — La corrélation mobile → backend fonctionne.**

Lancer l'app avec `EXPO_PUBLIC_TELEMETRY_ENABLED=true`, ouvrir un écran qui charge des
données, attendre 15 s (ou mettre l'app en arrière-plan, ce qui force un flush).
Dans *Traces*, filtrer `service_name = 'fridge-ai-mobile'`, ouvrir une trace : elle
contient le span client du téléphone **et**, sous lui, le span serveur, les spans
PostgreSQL et les appels sortants. Un seul `trace_id` du haut en bas.

Le même contrôle en une commande, sans téléphone :

```bash
TRACEPARENT="00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01"
curl -s -H "traceparent: $TRACEPARENT" http://localhost:3333/api/auth/methods > /dev/null
echo "$TRACEPARENT"      # chercher ce trace_id dans OpenObserve
```

**5 — Une panne de l'observabilité ne casse pas l'application.**

```bash
docker compose stop otel-collector openobserve
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/health          # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3333/api/auth/methods # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{"resourceSpans":[]}' \
  http://localhost:3333/api/telemetry/v1/traces                                 # 202
docker compose start otel-collector openobserve
```

L'app mobile se comporte pareil : les batches échouent, le backoff monte jusqu'à 5
minutes, la file est plafonnée à 256 éléments et les plus anciens sont jetés. Aucun
écran ne bloque, aucune requête ne rate.

Les tests automatisés couvrent la même propriété : `backend/tests/functional/telemetry`,
`backend/tests/infrastructure/telemetry` (liste blanche, troncature, corrélation), et
`mobile/src/infrastructure/telemetry/telemetry.test.ts` (en-tête `traceparent`, export
qui échoue sans que la requête échoue).

## Ce qui n'est jamais collecté

Refusé par construction, pas par convention :

| Donnée | Où c'est bloqué |
|---|---|
| `authorization`, `cookie`, `set-cookie` | jamais capturés par le SDK (`headersToSpanAttributes` non configuré) ; `redact` de pino ; processeur `attributes/redact` du Collector |
| mots de passe, tokens, secrets, clés d'API | `redact` de pino ; regex de rédaction du Collector ; liste blanche du relais |
| paramètres de requêtes SQL | `enhancedDatabaseReporting: false` |
| chaînes de requête d'URL | `url.query` supprimé par le Collector ; le mobile n'envoie que `url.path` |
| identifiants d'appareil, IDFA, langue, opérateur | jamais émis par `resource.ts`, et absents de la liste blanche du relais |
| corps de requête, structures imbriquées | `otlp-sanitizer.ts` ne garde que les valeurs OTLP scalaires |
| identifiant utilisateur en clair | remplacé par `enduser.pseudo.id`, HMAC-SHA256 tronqué, clé = `APP_KEY` |

Les erreurs d'authentification côté mobile ne remontent qu'un nom d'opération et un
`error.type` — jamais le message de l'erreur, qui peut contenir ce qu'on était en train
de vérifier. L'objet brut reste affiché en développement (`__DEV__`), sur une console
locale.

## Exploitation

**Volume et rétention.** `OBSERVABILITY_RETENTION_DAYS` (30 par défaut) borne le disque.
Le volume `openobserve-data` est le seul à sauvegarder ; s'il est perdu, on perd
l'historique, pas l'application.

**Échantillonnage.** À un foyer, tout garder (`OTEL_TRACES_SAMPLER_ARG=1.0`) est le bon
réglage. Si le volume devient gênant : baisser d'abord `EXPO_PUBLIC_TELEMETRY_SAMPLE_RATIO`
côté mobile — la décision se propage au backend via le flag du `traceparent`, donc une
trace échantillonnée l'est de bout en bout.

**Cardinalité.** Les dimensions de `spanmetrics` sont volontairement au nombre de trois
(`http.route`, `http.response.status_code`, `service.version`). Ajouter un identifiant
d'utilisateur ou de produit y ferait exploser le nombre de séries.

**Exposition.** `OBSERVABILITY_BIND` vaut `127.0.0.1`. Le Collector n'a aucune
authentification : le passer à `0.0.0.0` publie un point d'ingestion ouvert sur le
réseau local. Pour accéder à l'UI à distance, la faire passer par le reverse proxy du
homelab, avec TLS.

**Quotas.** `TELEMETRY_RATE_LIMIT_PER_MINUTE` (60) est un compteur en mémoire de
processus, par compte ou par IP. Avec plusieurs réplicas du backend, la limite effective
devient `limite × réplicas` ; à un seul conteneur, c'est exact.

**Mises à jour.** Les images sont épinglées dans `compose.yml`. Le Collector et
OpenObserve se mettent à jour indépendamment de l'application.

## Changer de backend de stockage

Un seul bloc bouge, dans `observability/otel-collector.yaml` :

```yaml
exporters:
  otlphttp/store:
    endpoint: ${env:OTLP_STORE_ENDPOINT}   # p. ex. http://signoz-otel-collector:4318
    headers:
      Authorization: Basic ${env:OTLP_STORE_AUTH}
```

Plus le compose du nouveau backend. Aucun code applicatif, aucune variable côté mobile.
