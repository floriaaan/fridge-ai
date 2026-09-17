# Scan du frigo par photo — Design

**Statut :** proposé (2026-09-16), révision 2, en attente de validation

## Contexte

Chantier 4 de `docs/roadmap-post-mvp.md` (ADR-0010) : le scan de ticket couvre les
courses, pas ce qui est déjà dans le frigo au premier lancement. L'approche prévue :
même modèle de port que le scan de ticket, extraction IA multimodale (ADR-0006),
puis relecture avant de créer les produits.

### Décisions prises en amont (2026-09-16)

1. **Photos multiples, pas de vidéo :** 1 à 5 photos (étagères, porte, bac,
   congélateur…). OpenAI `gpt-4o-mini` et Ollama n'acceptent pas la vidéo ; seul
   Gemini l'accepte. La vidéo est reportée.
2. **Une requête par photo**, quel que soit le fournisseur :
   - les modèles de vision locaux (Ollama) ne lisent souvent que la première image
     d'un message, alors qu'une image par appel fonctionne partout ;
   - la taille reste sous la limite de 20 Mo du bodyparser (10 Mo par photo) ;
   - le mobile suit l'avancement photo par photo ;
   - l'échec d'une photo n'annule pas les autres.
3. **Modèle IA visible dans l'app :** le backend expose les modèles effectifs (vision et
   texte). Ils sont affichés dans les réglages, et l'écran de scan prévient quand le
   modèle est local (plus lent).
4. **Tous les boutons de scan mènent à la page scanner** (`(tabs)/scan`), y compris les
   boutons « Scanner un ticket ». Le menu « Scanner quoi ? » disparaît.
5. **Doublons signalés :** pendant la relecture, une ligne dont le nom correspond à un
   produit déjà présent dans le foyer porte le badge « déjà au frigo » et est exclue par
   défaut.
6. **Emplacement deviné par l'IA** pour chaque produit (frigo / congélateur / placard),
   modifiable pendant la relecture.
7. **Contexte `fridge`**, pas de nouveau contexte : aucun agrégat « scan » n'est
   enregistré. Aucune migration.

## 1. Backend

### Domaine

- `domain/fridge/fridge-scan-draft.ts`

  ```ts
  export interface FridgeScanDraftItem {
    name: string
    quantity: number
    unit: string
    category: string | null
    location: 'fridge' | 'freezer' | 'pantry'
    expiresInDays: number | null
  }
  export interface FridgeScanDraft { items: FridgeScanDraftItem[] }
  ```

- `domain/fridge/interfaces/fridge-scan-extraction-port.interface.ts` :
  `extract(image: Buffer): Promise<FridgeScanDraft>` (une seule image, cf. décision 2).
- `domain/fridge/fridge-scan-extraction-prompt.ts` : un seul prompt partagé par les 3
  adaptateurs, comme `receipt-extraction-prompt.ts`. Règles :
  - N'inclure que les aliments ; ignorer les emballages vides et les bocaux non identifiables.
  - `quantity`/`unit` : nombre d'unités visibles (`"pièce"` par défaut) ; ne jamais
    inventer un poids.
  - `location` : déduit de la photo (givre, bac à glaçons ⇒ `freezer` ; étagère sèche ⇒
    `pantry` ; sinon `fridge`).
  - `expiresInDays` : estimation à partir d'aujourd'hui, en supposant que le produit est
    entamé ou déjà stocké depuis un moment (donc plus prudente que sur un ticket). `null`
    si l'IA n'a pas d'estimation raisonnable.
- `domain/fridge/fridge-scan-draft-parser.ts` : même rôle que `receipt-draft-parser.ts`.
  Une `location` inconnue devient `fridge` au lieu de faire échouer toute la photo.
  Réutilise `ReceiptExtractionUnavailableError` et `ReceiptExtractionParseError` telles
  quelles : les renommer en erreurs génériques serait du bruit.
- `EffectiveAiSettings` reçoit un nouveau champ `models: { vision: string; text: string }`
  : les modèles réellement utilisés par le fournisseur actif, ou `''` si le modèle Ollama
  n'est pas configuré.

### Application

- `ScanFridge` (`application/fridge/scan-fridge.use-case.ts`) : même forme que
  `ScanReceipt`, entrée `{ image: Buffer }`, erreurs
  `'provider_not_configured' | 'extraction_failed'`.
- `ImportProducts` (`application/fridge/import-products.use-case.ts`) : crée N produits
  avec `receiptId: null` et `price: null`. Même logique que la boucle produits de
  `ImportReceipt` (validation `Quantity`/`Location`, tout est validé avant la première
  écriture).

### Infrastructure

- 3 adaptateurs `{openai,gemini,ollama}-fridge-scan-extraction.adapter.ts`, copies du
  ticket avec un autre prompt et un autre parser.
- **Noms des modèles :** `'gemini-2.5-flash'` et `'gpt-4o-mini'` sont écrits en dur dans
  4 adaptateurs. Ils sont regroupés dans une constante `AI_MODELS`, dans
  `ai-provider-registry.ts`. Les adaptateurs cloud reçoivent le modèle en paramètre du
  constructeur, comme ceux d'Ollama. Il n'y a ainsi qu'une source de vérité pour les
  adaptateurs et pour `resolveEffective()`.
- `EnvAiSettingsProvider.resolveEffective()` renseigne `models` selon le fournisseur
  actif :
  - Ollama : `OLLAMA_VISION_MODEL` / `OLLAMA_TEXT_MODEL` ;
  - OpenAI et Gemini : valeurs de `AI_MODELS`.
- `ai-provider-registry.ts` : `resolveFridgeScanExtractionAdapter`, avec son propre cache
  et une surcharge `__setFridgeScanExtractionOverrideForTests` (même modèle que les deux
  existants).
- `settings_provider.ts` : binding `settings.resolveFridgeScanExtractionPort`.

### Présentation

- `POST /api/products/scan` (multipart, champ `image`, jpg/jpeg/png/webp, 10 Mo)
  ⇒ `{ draft }`. Mêmes logs d'upload invalide que `receipt.scan`.
- `POST /api/products/import` `{ items: [{ name, quantity, unit, category?, location,
  expiresAt? }] }` (1 élément minimum) ⇒ `201 { products }`.
- Les deux routes sont `POST` : pas de conflit avec `GET /products/:id`.
- Actions tracées : `product.scan`, `product.import`.
- `GET /api/settings/ai` renvoie `models` sans autre changement (le DTO est
  `EffectiveAiSettings`).

## 2. Mobile

### Page scanner (`presentation/fridge/scan-screen.tsx`)

Troisième `ScanChoice`, placé en premier (c'est le point d'entrée du premier lancement) :

- **Titre :** « Mon frigo »
- **Sous-titre :** « Quelques photos, l'IA repère tout ce qu'il contient. »
- **Couleur :** `navCardWarm`. Les coins alternent `a`/`b`/`a`.

Le lien vers la page scanner va dans `scan-sheet.tsx` (renommé `scan-navigation.ts`) :
`goToScan()`, `goToProductScan()`, `goToReceiptScan()` et `goToFridgeScan()`.

### Écran de prise de vue (`presentation/fridge/fridge-scan-camera-screen.tsx`)

Route `app/fridge-scan/scan.tsx` (modal), avec un layout identique à `receipts/_layout.tsx`.

- Caméra en plein écran, comme `ReceiptScannerScreen`. Chaque photo prise s'ajoute à une
  bande de miniatures (croix pour la retirer). Limite de 5 photos.
- « Galerie » : `launchImageLibraryAsync({ allowsMultipleSelection: true,
  selectionLimit: 5 - n })`.
- Bouton « Analyser (n) », actif dès 1 photo ⇒ `router.replace('/fridge-scan/review',
  { imageUris: JSON.stringify(uris) })`.
- Consigne : « Une photo par étagère, porte ouverte ».
- Si `activeProvider === 'ollama'`, une ligne en plus : « Modèle local ({models.vision}) :
  compte environ une minute par photo. » (données issues de la requête des réglages IA
  déjà en cache).
- Réutilise `CameraPermissionModal` avec la galerie en solution de repli, comme pour le
  ticket.

### Relecture (`presentation/fridge/fridge-scan-review-screen.tsx`)

Route `app/fridge-scan/review.tsx`.

**Analyse, une photo après l'autre.** Les photos sont analysées l'une après l'autre, sans
parallélisme : un Ollama local traiterait les requêtes en file de toute façon, et les
envoyer en parallèle ne ferait que multiplier les timeouts. La logique est un hook
`useFridgeScan(imageUris)`, qui renvoie un état par photo :
`pending | running | done(items) | failed(error)`.

- **Avancement :** bande de miniatures, chacune avec son état (animation en cours,
  coche + « 4 produits », croix d'erreur), et un titre « Analyse de la photo 2 sur 4 ».
- **Échec d'une photo :** l'erreur est gardée pour cette photo et la suivante est
  lancée. L'écran ne plante jamais, et chaque miniature en échec propose « Réessayer ».
- **`provider_not_configured` :** arrêt immédiat, car les photos suivantes échoueraient
  de la même façon. L'écran affiche l'erreur typée existante, sans « Réessayer ».
- **Échec d'une connexion :** même traitement qu'une photo en échec.
- **Relecture pendant l'analyse :** les lignes des photos terminées s'affichent au fur et
  à mesure. La relecture peut commencer pendant que les autres photos sont analysées.
- **Toutes les photos en échec :** état d'erreur plein écran avec « Réessayer » (relance
  toutes les photos) et « Reprendre les photos ».
- **Import :** « Ajouter N produits » reste désactivé tant qu'une photo est en cours.
  Tant qu'une photo est en échec, un bandeau indique « 1 photo n'a pas pu être
  analysée » ; l'import reste possible sans elle.

**Fusion entre photos.** Un même produit peut apparaître sur deux photos (étagères qui se
chevauchent). Les lignes dont le nom normalisé et l'emplacement sont identiques sont
fusionnées, en gardant la **plus grande** quantité et non la somme :
`// ponytail: max, not sum — two identical items on two shelves undercount; editable in review`.
La fusion est une fonction pure, testée à part.

**Rendu des lignes.**

- Même structure que `ReceiptReviewScreen` : lignes repliées, action groupée « range tout
  ici », erreurs par champ, état de succès. Pas de carte magasin / date / total.
- `ReceiptItemRow` réutilisé avec une nouvelle prop `showPrice={false}`.
- La date de péremption estimée part d'aujourd'hui et porte le libellé « estimée »
  (mécanisme déjà en place).

**Doublons avec le frigo.**

- Comparaison côté client avec la requête produits déjà en cache. Les noms sont
  normalisés (minuscules, sans accents, espaces compactés) ; il y a doublon si les noms
  sont identiques ou si l'un contient l'autre. Aucun endpoint en plus.
- La ligne affiche le badge « déjà au frigo » et un interrupteur « Ajouter quand même »
  (désactivé par défaut). Les lignes exclues ne sont pas envoyées.

### Réglages

La ligne « Fournisseur IA » de `settings-screen.tsx` affiche aussi les modèles, par
exemple « Vision : llava:13b · Texte : llama3.1 ». Un modèle vide s'affiche « non
configuré » en couleur d'alerte : c'est la cause silencieuse d'un
`provider_not_configured` avec Ollama.

### Données

- `AiSettings` (mobile) reçoit `models: { vision: string; text: string }`.
- `FridgeConnector` :
  - `scanFridgePhoto(imageUri: string)` : même logique de `FormData` que `scanReceipt`,
    à extraire dans un helper partagé de `http-fridge-connector.ts` ;
  - `importProducts(items)`.
  Chaque méthode a une implémentation HTTP et une implémentation fake avec une fixture.
  La fixture fake fait échouer une photo sur trois quand l'URI contient `fail`, pour
  pouvoir tester l'échec partiel.
- `useImportProductsMutation`. Après un import, invalider les mêmes requêtes produits
  que l'import de ticket. Le scan passe par `useFridgeScan`, sans mutation React Query :
  ce sont N appels orchestrés, pas une mutation.

### Boutons redirigés vers la page scanner

| Endroit | Avant | Après |
|---|---|---|
| Bouton flottant sur Accueil / Frigo / Recettes / Courses | menu « Scanner quoi ? » | `goToScan()` |
| Bouton Scanner de la sidebar (desktop) | menu, ou Accueil hors onglet | `goToScan()` |
| Dashboard vide, « Scanner un ticket » | scan de ticket | `goToScan()`, libellé « Scanner » |
| Liste des tickets vide, « Scanner un ticket » | scan de ticket | `goToScan()`, libellé « Scanner » |
| Visite guidée, « Scanner un ticket » | scan de ticket | `goToScan()`, libellé « Scanner », texte mentionnant aussi la photo du frigo ; prop renommée `onScan` |

Inchangés, car ces boutons prolongent une action déjà en cours et ne sont pas des points
d'entrée :

- le bouton code-barres du formulaire produit (`fromForm`, mode édition) ;
- « Reprendre la photo » sur la relecture du ticket.

`useScanSheet` est supprimé, ainsi que son `{scanSheet}` dans les 4 écrans.
`ActionSheet` est conservé (utilisé ailleurs).

Texte du dashboard vide : « Ajoute un produit, photographie ton frigo ou scanne un ticket
pour démarrer. »

## 3. Tests (écrits, non exécutés — cf. AGENTS.md)

- **Backend :**
  - specs unitaires `ScanFridge` (correspondance des erreurs) et `ImportProducts`
    (validation, `receiptId` null) ;
  - parser (JSON valide, `location` inconnue ⇒ `fridge`, JSON invalide ⇒ erreur) ;
  - `EnvAiSettingsProvider` (`models` selon le fournisseur, Ollama sans modèle ⇒ `''`).
- **Mobile :**
  - `scan-screen` : les 3 choix naviguent vers la bonne route ;
  - fonctions pures `mergeScanItems` (fusion par nom + emplacement, quantité max) et
    `isLikelyDuplicate` ;
  - `useFridgeScan` :
    - traitement séquentiel ;
    - une photo en échec n'arrête pas les suivantes ;
    - `provider_not_configured` arrête tout ;
    - « Réessayer » ne relance que la photo concernée ;
  - relecture : les lignes exclues ne sont pas importées, l'import est bloqué tant
    qu'une photo est en cours ;
  - mise à jour des tests existants qui utilisaient `scan-sheet-*` et `AiSettings`.

## 4. Hors périmètre

- Vidéo (y compris l'extraction d'images) : à reconsidérer si les photos multiples ne
  suffisent pas.
- Fusion des quantités avec un produit **déjà en base** (seulement signalé).
- Conservation des photos du frigo côté serveur (pas d'`imageKey`, pas de rétention à
  gérer).
- Historique des scans de frigo.
- Poursuite de l'analyse en arrière-plan si l'utilisateur quitte l'écran : les photos
  pas encore analysées sont abandonnées.
