---
version: 1
slug: "src-presentation-onboarding-threshold-screen-tsx"
primary_target: "src/presentation/onboarding/threshold-screen.tsx"
related_targets: ["src/presentation/onboarding/invite-code-field.tsx","src/presentation/onboarding/first-run-tour.tsx"]
---

Scope: le groupe `(onboarding)` — le seuil créer/rejoindre, le scan QR du code, et les quatre temps posés sur le dashboard réel. Mode visiteur : Operate.

Audience : deux populations. Le fondateur, seul dans sa cuisine, qui nomme le foyer et repart avec un code. Le rejoignant, qui arrive avec un code déjà en main — souvent depuis un lien `fridgeai://join?code=…` ou un QR.

Contraintes : le backend est complet (`POST /api/households`, `POST /api/households/join`, code `^[A-Z0-9]{8}$`) mais le connecteur mobile n'expose ni l'un ni l'autre. Le blocage est un vrai gate à écrire dans `(tabs)/_layout.tsx`, dont le miroir est `(onboarding)/_layout.tsx`. Quitter un foyer cesse d'être une déconnexion.

Hors périmètre : aucune amorce de remplissage. Le dernier temps du tour peut offrir le scanner ; il ne l'impose pas.

Non résolu : pas d'universal link — l'instance est auto-hébergée, il n'existe aucun domaine à revendiquer, donc le partage repose sur le schéma `fridgeai://` plus le code en clair.

## Direction contract

THESIS: l'onboarding est un seuil franchi, pas un couloir traversé. Une décision plein écran — créer un foyer ou en rejoindre un — puis le vrai dashboard qui se présente lui-même. Refuse le stepper à cinq écrans et le carrousel de slides.

OWN-WORLD: le Sunlit Pantry engagé — sol blob menthe, une seule surface mocha par écran, lime réservée à l'action, angles asymétriques, `Chip` / `PillButton` / `AuthField` / `ActionSheet` livrés. Aucun token nouveau.

STORY: le fondateur nomme le foyer et repart avec un code à partager ; le rejoignant arrive par lien ou QR, code déjà posé dans les cases, et atterrit dans le même garde-manger.

FIRST VIEWPORT: carotte + FRIDGE AI en haut, une question, puis deux surfaces de poids inégaux — la mocha (créer) porte l'écran, la carte crème dessous porte directement huit cases de code, pas un bouton vers un écran de plus. Pas de retour : le compte existe déjà. Interaction signature : les huit cases se remplissent caractère par caractère quand un code est collé ou scanné, une cellule toutes les 45 ms, remplissage direct sous Reduce Motion. Le tour montre un temps à la fois, jamais quatre.

FORM: « Le seuil, puis la maison », candidat 6 sur sept, clé de tirage be93e49c. Code-led : aucun outil d'image dans ce harness.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
