---
target: mobile/src/presentation
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/home/floriaaan/dev/fridge-ai/mobile/src/presentation"
timestamp: 2026-09-06T10-23-09Z
slug: mobile-src-presentation
---
Method: dual-agent (A: revue de design · B: scan déterministe). Le retour de B est parvenu au parent avant celui de A, alors que l'ordre inverse est prescrit ; sans effet ici — B n'a produit aucune découverte, et A a travaillé isolée.

## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|---|---|---|
| 1 | Visibilité de l'état système | 3 | Skeletons, `PulseDots`, `—` honnête excellents — mais `(tabs)/_layout.tsx:54` et `(auth)/_layout.tsx:7` font `return null` sur `session.isPending` : première frame blanche sans chrome. |
| 2 | Correspondance système / monde réel | 3 | « Garde-manger » porte un `RefrigeratorIcon` et contient un emplacement « Frigo ». |
| 3 | Contrôle et liberté | 3 | Aucun undo ; aucun moyen de marquer un produit consommé. |
| 4 | Cohérence et standards | 2 | Le dashboard contourne `ScreenHeader` ; `ProductRow` contourne `StatusChip`, sans icône et avec un autre mot. |
| 5 | Prévention des erreurs | 3 | Un tap de chip (`settings-screen.tsx:168`) change le provider IA pour toute l'instance, sans confirmation. |
| 6 | Reconnaissance plutôt que rappel | 3 | Le récapitulatif de 24 choix est un 11px `numberOfLines={2}`. |
| 7 | Flexibilité et efficacité | 2 | Aucune action groupée. Six produits périmés = 6 taps + 6 sheets + 6 confirmations. |
| 8 | Esthétique et minimalisme | 3 | Le compte de courses est imprimé deux fois, même destination. |
| 9 | Récupération d'erreur | 2 | `fridge-list-screen.tsx` ne lit jamais `products.isError` (vérifié : zéro occurrence). |
| 10 | Aide et documentation | 1 | Aucun onboarding, aucune explication de « foyer », aucun point d'aide. |
| **Total** | | **25/40** | Correct, avec deux fautes qui mentent à l'utilisateur |

## Verdict de spécificité

L'app est bimodale : écrans profonds irremplaçables, porte d'entrée interchangeable — et en mode Operate c'est la porte d'entrée qui est jugée.

De ce produit : `FridgeCabinet` (émail froid, liner plus clair que la coque, refus des poignées chromées), `expiryLabel` (registre de cuisinier sur une surface que plusieurs colocataires lisent), les `PantryRow` épinglables, le bloc-notes à spirale.

Interchangeable : `household-dashboard.tsx`, dont le contrat de direction concède « habit-app register applied to food waste ». Trois cartes pastel à pastille, deux tuiles sous « Accès rapide », hero sombre à surtitre. Cinq chaînes changées = app de fitness/budget/langues. Deux des trois métriques d'accueil d'une app de cuisine portent une signalétique d'avertissement ; aucune nourriture dans l'iconographie du dashboard hors les trois rendus Fluent Emoji déclarés comme trouvés.

Scan déterministe : exit 0, zéro découverte — sans valeur probante. Sur 61 règles, ~48 exigent un moteur navigateur (aucun outil exposé), 5 sont exclues car `.tsx` n'est pas une extension page-analyzer, et les ~9 matchers source cherchent des classes Tailwind et des chaînes CSS dont le dépôt contient zéro occurrence. Contrôle positif de l'agent B : `borderRadius={137}` et un hex hors palette en attribut JSX passent propres. Faux négatifs par construction, pas faux positifs. Aucune vérification navigateur possible.

## Impression générale

Le système de design est meilleur que l'app qui l'applique ; `DESIGN.md` consigne ses arbitrages, y compris ce qu'il a abandonné. Mais deux écrans mentent sur de l'état partagé, et le tableau de bord donne trois nombres irréconciliables pour la même question. Plus grande opportunité : fermer la boucle. L'app dit ce qui périme, propose une recette, et n'a aucune façon d'enregistrer que tu l'as cuisinée.

## Ce qui marche

1. `product-status.ts` comme source de vocabulaire unique — dans un frigo partagé un texte de statut est un objet social, et le fichier le traite comme tel.
2. `FridgeCabinet` comme exception matérielle déclarée et bornée à un écran, avec son compromis consigné en tête de fichier.
3. `pulse-dots.tsx` — trois points aux couleurs de chips, décalage 150 ms, jamais éteints, immobiles sous Reduce Motion, une étiquette `progressbar`.

## Problèmes prioritaires

### [P0] Le garde-manger annonce un frigo vide quand le serveur est injoignable
`fridge-list-screen.tsx:395-403` teste `isPending` puis `isEmpty`, jamais `isError` (zéro occurrence dans le fichier), alors que `recipe-list-screen`, `shopping-list-screen` et le dashboard le testent. Même bug dans `settings-screen.tsx` (« Aucun foyer »). C'est l'écran ouvert devant le frigo sur un réseau faible : « Les étagères sont vides » est une affirmation fausse sur de la donnée partagée, et le remède proposé aggrave. Fix : branche `isError` au-dessus de `isEmpty`, message coral + pilule « Réessayer » ; idem pour `household` ; puis un test exigeant une branche `isError` par query rendue. → `/impeccable harden`

### [P0] Les trois nombres du dashboard ne se réconcilient pas
`heroHeadline()` compte `soonCount + expiredCount` (−∞…3), « Cette semaine » 0…7, « Dates dépassées » < 0. Trois fenêtres à 200 pt d'écart, sans relation arithmétique. Premier balayage du mode Operate, à une main. Fix : que le nombre du hero soit l'une des cartes (ramener la semaine à 0-3, ou faire lire au hero semaine + dépassées) ; puis supprimer soit la carte « À racheter » soit le sous-titre chiffré de la NavCard Courses. → `/impeccable distill`

### [P1] Le lecteur d'écran entend des noms de produits sans aucune date
`fridge-list-screen.tsx:66` pose `accessibilityLabel={product.name}` sur un `Pressable` : quantité, `expiryLabel` et badge inaudibles. Idem `receipts-row.tsx` et `settings-screen.tsx:151`. Et `household-dashboard.tsx` rend `—` pendant le chargement mais interpole le compte dans l'`accessibilityLabel` sans condition. `PreviewRow` fait déjà les choses correctement — le motif existe. → `/impeccable audit`

### [P1] Aucun moyen de consommer un produit, seulement de le supprimer
Pas de `consumedAt` ; seule conséquence UI = l'`ActionSheet` destructif du détail. La boucle est cassée : tu cuisines la recette, tu manges, l'app les montre encore comme périssant. Le compte du matin ne peut que monter — le tableau de bord passe d'outil à réquisitoire. Fix immédiat : multi-sélection par appui long (idiome déjà établi par la liste de courses), un seul « Retirer N produits ». À terme, `consommé` vs `jeté` est une vraie décision produit. → `/impeccable shape`

### [P2] Le compositeur pose 24 questions avant celle qui n'appartient qu'à cette app
`CookingFrom` s'affiche en premier mais son affordance est une légende grise 11px. En dessous, 24 chips génériques ; quatre des six titres sous la ligne de flottaison. L'argument visuel de l'écran est le formulaire, pas le raccourci. Fix : état pilule visible sur `PantryRow`, six groupes repliés derrière « Affiner ». → `/impeccable layout`

## Signaux d'alerte par persona

- **Cuisinière pressée, 19h10** : frame blanche, puis hero à 5 / carte à 9 / carte à 2. « Cette semaine » atterrit dans un meuble groupé par compartiment où `sortByExpiry` ne trie qu'à l'intérieur d'une étagère — la carte posait une question d'urgence, l'écran répond par une géographie. ~210 pt de bloc épinglé avant le premier produit.
- **Colocataire nouveau** : le dashboard ne montre jamais les autres membres ; `MemberAvatars` est à deux taps dans Réglages. Le FAB ouvre un `ActionSheet` sans `title` (vérifié). Le partage n'est énoncé nulle part avant la sheet de suppression.
- **Lecteur d'écran / Dynamic Type 200 %** : « Lait, bouton. Yaourt, bouton. » Le FAB annonce « Scanner un produit » et ouvre deux choix dont un ticket. À 200 %, `ScreenHeader` en `numberOfLines={1}` entre un carré 38 pt et une pilule 44 pt tronque « Garde-manger » (troncature exacte à confirmer par capture).

## Observations mineures

- `RecoveryPill` `tone="error"` : `gradientBottom` dans `expiredBg` — en sombre, une pilule plus sombre que sa carte, lue comme un trou.
- `settings-screen.tsx` ne lit jamais `setProvider.isPending`.
- La déconnexion est la seule action conséquente hors `ActionSheet`.
- La branche `pending` de `GenerateButton` est du code mort depuis le passage du loader hors popup, et reste le dernier `ActivityIndicator` de la couche présentation.
- Cinq implémentations locales de « pilule lime avec label ». Les chips ont été consolidés, les pilules non.
- Commentaire périmé sur le prop `secondary` de `StatCard`.

## Questions à considérer

1. Si « Dates dépassées » ne peut que monter, à quoi sert-il ? L'app ne distingue pas un foyer qui cuisine bien d'un qui gaspille.
2. Pourquoi l'accueil d'une app de frigo partagé ne montre-t-il jamais les gens qui le partagent ?
3. Le meuble devrait-il abandonner ses étagères quand il arrive filtré depuis une carte d'urgence ?
4. Pourquoi `goAddProduct()` détruit-il sans confirmation les 24 choix que la fermeture protège ?
5. « Icône ET couleur ET mot » est-il encore porteur, ou est-ce la documentation d'une intention que le code a cessé de suivre ?
