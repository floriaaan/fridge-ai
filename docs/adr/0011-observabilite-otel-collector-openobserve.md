# ADR-0011 — Observabilité : OpenTelemetry, un Collector, OpenObserve

## Contexte

L'application n'avait aucune observabilité : côté backend, des logs pino sur stdout
et rien d'autre ; côté mobile, quelques `console.warn` et deux `console.log` qui
déversaient une réponse `household` complète dans les logs de l'appareil. Debugger
« l'app rame quand j'ouvre mes recettes » voulait dire deviner.

Le besoin est le suivant : logs, traces et métriques, pour le backend *et* le mobile,
auto-hébergeables, corrélés — pouvoir partir d'un écran qui échoue sur le téléphone
et suivre la requête jusqu'au span PostgreSQL qui l'a fait échouer.

## Décision

**Instrumentation** : OpenTelemetry des deux côtés, OTLP sur le fil, W3C trace context
pour la corrélation. Aucun protocole maison, aucun identifiant de corrélation inventé.

**Point d'entrée unique** : un OpenTelemetry Collector. C'est lui qui batche, réessaie,
filtre, redonne des attributs de ressource et rédige. C'est surtout la couture qui évite
l'enfermement : changer de backend de stockage, c'est modifier le bloc `exporters` de
`observability/otel-collector.yaml`, et rien d'autre dans le dépôt ne bouge.

**Stockage : OpenObserve, pas SigNoz.** SigNoz était l'hypothèse de départ et reste
un bon produit — son UI de traces et d'exceptions est meilleure. Mais son déploiement
auto-hébergé demande aujourd'hui cinq conteneurs (ClickHouse, ClickHouse Keeper, un
PostgreSQL *supplémentaire*, son propre collector, l'application), 4 Go de RAM au
minimum et 8 Go recommandés, et son compose est désormais généré par un outil maison
(`foundryctl`) plutôt que versionné tel quel — donc impossible à épingler proprement
ici sans que ça pourrisse. Pour un homelab qui fait déjà tourner Postgres et l'API,
c'est un coût réel et récurrent.

OpenObserve fait les trois signaux, nativement OTLP, dans **un** binaire, avec une
authentification intégrée et de la rétention configurable. Sur les critères retenus —
simplicité, fiabilité, maintenabilité, ressources — il gagne. On y perd en confort
d'UI côté APM ; le Collector rend cette perte réversible en une ligne.

**Le mobile ne parle jamais au Collector.** Il poste ses batches OTLP/JSON sur
`POST /api/telemetry/v1/{traces,logs}`, relayé par le backend. Un Collector n'a ni
authentification, ni quota, ni notion d'utilisateur : l'exposer publiquement, c'est
offrir un moyen de remplir le stockage à qui trouve l'URL. Un jeton partagé embarqué
dans le bundle de l'app n'est pas un secret et ne change rien à ça. Le backend, lui,
est déjà public, déjà authentifié, et sait à qui il parle — il ajoute un quota par
compte (ou par IP quand il n'y a pas de session, car l'écran de connexion est
précisément là où la télémétrie sert), un plafond de taille de corps, et une
liste blanche d'attributs.

**Les métriques mobiles sont dérivées, pas émises.** Le connector `spanmetrics` du
Collector calcule les métriques RED à partir des spans relayés. Le téléphone n'embarque
donc pas de SDK de métriques, ne maintient pas d'état d'agrégation et ne réveille pas
la radio pour un troisième pipeline.

**Pas de SDK OpenTelemetry sur le mobile.** Il n'existe pas de distribution React Native
supportée : `sdk-trace-web` suppose des API navigateur, il n'y a pas d'équivalent
`async_hooks` sur Hermes pour le context manager, et les wrappers communautaires sont
en pré-1.0. Ce qu'on veut d'OpenTelemetry ici, c'est le *protocole* — trace context sur
le fil, OTLP à l'export — et les deux sont des spécifications stables qui tiennent dans
`mobile/src/infrastructure/telemetry/`. Le backend, où le SDK est supporté et où se
trouve l'instrumentation difficile (HTTP, Postgres, appels sortants), utilise le vrai SDK.

## Conséquences

- L'observabilité fait partie de la stack par défaut (`task up`). Elle n'est jamais un
  `depends_on` : `task up:app-only` démarre `db` + `backend` seuls, et arrêter les deux
  conteneurs ne coûte que la télémétrie.
- Toute erreur d'export est avalée : le bootstrap OTel est dans un `try`, le relais
  n'est pas attendu par le contrôleur, l'exporteur mobile a un backoff exponentiel et
  se désactive pour la session sur un 404.
- Un attribut nouveau côté app n'arrive pas tout seul dans le stockage : la liste
  blanche de `otlp-sanitizer.ts` doit être mise à jour. C'est le prix d'une liste
  blanche, et c'est le bon sens de la friction.
- Rien d'identifiant ne quitte le téléphone : ni modèle d'appareil, ni identifiant
  publicitaire, ni langue, ni opérateur. L'identité utilisateur, quand elle existe,
  est un HMAC tronqué calculé côté serveur (`enduser.pseudo.id`).
