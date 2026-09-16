import type { LandingContent } from '../../domain/content/landing-content.js'

// ponytail: content is bundled with the site; move it behind the connector's
// HTTP side once a CMS or a backend endpoint serves it.
export const landingContentFr: LandingContent = {
  repositoryUrl: 'https://github.com/floriaaan/fridge-ai',
  hero: {
    eyebrow: 'Open source · clé en main ou chez toi',
    titleBefore: 'Du frigo à l’assiette, ',
    titleHighlight: 'sans rien jeter',
    titleAfter: '.',
    subtitle:
      'Garde-manger tient l’inventaire du frigo de tout le foyer, prévient avant les dates et propose quoi cuisiner avec ce qui reste. Clé en main, ou sur ton propre serveur.',
    screenshots: [
      {
        src: '/screenshots/accueil.jpg',
        alt: 'Accueil de Garde-manger : 5 produits à cuisiner en premier, les compteurs de la semaine et la liste des produits à consommer en premier.',
      },
      {
        src: '/screenshots/recettes.jpg',
        alt: 'Écran Recettes : une poêlée poulet-épinards proposée pour ce soir avec 2 ingrédients sur 3 déjà chez toi.',
      },
    ],
  },
  features: [
    {
      id: 'receipt',
      title: 'Le ticket de caisse, en une photo',
      description:
        'Chaque article rejoint le garde-manger avec sa quantité et son prix. Une seule lecture par l’IA, pas d’OCR à part.',
      illustration: 'receipt',
    },
    {
      id: 'expiry',
      title: 'Les dates, sans y penser',
      description:
        'Frais, en premier, dépassé : chaque produit dit où il en est, et l’accueil montre ce qui doit partir cette semaine.',
      illustration: 'carrot',
    },
    {
      id: 'recipes',
      title: 'Des recettes avec ce qui reste',
      description:
        'L’IA part des produits qui approchent de leur date. Une fois cuisinée, la recette retire ce qu’elle a utilisé.',
      illustration: 'pot-of-food',
    },
    {
      id: 'shopping-list',
      title: 'Une liste de courses commune',
      description:
        'Tout le foyer ajoute, coche et voit la même liste, synchronisable avec Home Assistant.',
      illustration: 'shopping-cart',
    },
  ],
  offers: {
    titleHighlight: 'Deux façons',
    titleAfter: ' de s’y mettre',
    subtitle:
      'Même app, mêmes fonctionnalités. Prends la version clé en main pour démarrer en une minute, ou installe tout chez toi pour que rien ne quitte la maison.',
    hosted: {
      label: 'Clé en main',
      tag: 'Le plus simple',
      title: 'Tu installes l’app, on s’occupe du reste.',
      description: 'Pas de serveur, pas de mises à jour, pas de sauvegardes à gérer. Ton foyer est prêt dès l’inscription.',
      perks: ['Hébergé et sauvegardé pour toi', 'Mises à jour automatiques', 'Chacun son compte, un foyer partagé'],
      tiers: [
        { name: 'Gratuit', description: 'Inventaire, dates de péremption, liste de courses partagée.' },
        { name: 'Abonnement IA', description: 'Tickets de caisse en une photo et recettes avec ce qui reste.' },
      ],
      cta: { label: 'Ouverture bientôt', href: null },
    },
    selfHosted: {
      label: 'Auto-hébergé',
      tag: 'Local-first',
      title: 'Tout reste chez toi.',
      description:
        'Pour qui veut garder la main : l’API tourne sur ta machine, l’app ne parle qu’à ton serveur.',
      perks: [
        'Les données ne quittent pas la maison',
        'IA locale avec Ollama, ou ta clé Gemini / OpenAI',
        'Open source, licence MIT',
      ],
      commands: [
        'git clone https://github.com/floriaaan/fridge-ai.git && cd fridge-ai',
        'cp .env.example .env',
        'docker compose up -d',
      ],
      cta: { label: 'Lire le guide', href: 'https://github.com/floriaaan/fridge-ai#readme' },
    },
  },
  faq: [
    {
      question: 'C’est vraiment gratuit ?',
      answer:
        'Oui. Le code est sous licence MIT et l’auto-hébergement est complet, IA comprise : tu branches ta clé Gemini ou OpenAI, ou un modèle local via Ollama. Rien n’est réservé à une version payante.',
    },
    {
      question: 'Et si je ne veux pas gérer de serveur ?',
      answer:
        'Une offre clé en main est en préparation : gratuite pour l’essentiel, avec un abonnement pour les fonctionnalités IA (scan de tickets, recettes). Elle n’est pas encore ouverte.',
    },
    {
      question: 'Mes données partent-elles ailleurs ?',
      answer:
        'L’app ne parle qu’à ton serveur. C’est lui qui interroge OpenFoodFacts ou le fournisseur IA que tu as choisi — et avec Ollama, rien ne sort de chez toi.',
    },
    {
      question: 'On peut être plusieurs ?',
      answer:
        'C’est le principe : un foyer, plusieurs membres, un seul garde-manger partagé. On rejoint un foyer avec son code d’invitation.',
    },
    {
      question: 'Comment se connecte-t-on ?',
      answer:
        'Par email et mot de passe, ou via ton instance PocketID. Le mot de passe peut être désactivé pour n’utiliser que PocketID.',
    },
    {
      question: 'Sur quels appareils ?',
      answer:
        'iOS, Android et le web. Les apps ne sont pas encore sur les stores : en attendant, elles se lancent depuis le dépôt avec Expo.',
    },
  ],
  stores: { appStore: null, playStore: null },
}
