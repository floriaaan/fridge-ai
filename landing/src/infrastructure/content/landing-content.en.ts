import type { LandingContent } from '../../domain/content/landing-content.js'

// ponytail: content is bundled with the site; move it behind the connector's
// HTTP side once a CMS or a backend endpoint serves it.
export const landingContentEn: LandingContent = {
  locale: 'en',
  repositoryUrl: 'https://github.com/floriaaan/fridge-ai',
  hero: {
    eyebrow: 'Open source · hosted or self-hosted',
    titleBefore: 'From the fridge to the plate, ',
    titleHighlight: 'nothing wasted',
    titleAfter: '.',
    subtitle:
      'Garde-manger tracks the whole household’s fridge, warns before dates pass, and suggests what to cook with what’s left. Hosted for you, or on your own server.',
    screenshots: [
      {
        src: '/screenshots/accueil.jpg',
        alt: 'Garde-manger home screen: 5 products to cook first, this week’s counters and the list of items to use soonest.',
      },
      {
        src: '/screenshots/recettes.jpg',
        alt: 'Recipes screen: a chicken-and-spinach skillet suggested for tonight, with 2 of 3 ingredients already at home.',
      },
    ],
  },
  features: [
    {
      id: 'receipt',
      title: 'The receipt, in one photo',
      description:
        'Every item joins the pantry with its quantity and price. One AI read, no separate OCR step.',
      illustration: 'receipt',
    },
    {
      id: 'expiry',
      title: 'Dates, without the mental load',
      description:
        'Fresh, first-to-go, expired: every product says where it stands, and the home screen shows what needs using this week.',
      illustration: 'carrot',
    },
    {
      id: 'recipes',
      title: 'Recipes with what’s left',
      description:
        'The AI starts from the products closest to their date. Once cooked, the recipe removes what it used.',
      illustration: 'pot-of-food',
    },
    {
      id: 'shopping-list',
      title: 'One shared shopping list',
      description:
        'The whole household adds, ticks and sees the same list, syncable with Home Assistant.',
      illustration: 'shopping-cart',
    },
  ],
  offers: {
    titleHighlight: 'Two ways',
    titleAfter: ' to get started',
    subtitle:
      'Same app, same features. Take the hosted version to start in a minute, or install everything at home so nothing leaves the house.',
    hosted: {
      label: 'Hosted',
      tag: 'The easy way',
      title: 'You install the app, we handle the rest.',
      description: 'No server, no updates, no backups to manage. Your household is ready as soon as you sign up.',
      perks: ['Hosted and backed up for you', 'Automatic updates', 'Your own account, one shared household'],
      tiers: [
        { name: 'Free', description: 'Inventory, expiry dates, shared shopping list.' },
        {
          name: 'AI plan',
          description: 'Receipts in one photo and recipes with what’s left.',
          price: '€2/month',
        },
      ],
      cta: { label: 'Opening soon', href: null },
    },
    selfHosted: {
      label: 'Self-hosted',
      tag: 'Local-first',
      title: 'Everything stays home.',
      description:
        'For anyone who wants full control: the API runs on your own machine, the app only ever talks to your server.',
      perks: [
        'Data never leaves the house',
        'Local AI with Ollama, or your Gemini / OpenAI key',
        'Open source, MIT licence',
      ],
      commands: [
        'git clone https://github.com/floriaaan/fridge-ai.git && cd fridge-ai',
        'cp .env.example .env   # secrets + your server’s IP',
        'docker compose up -d',
      ],
      cta: { label: 'Read the guide', href: 'https://github.com/floriaaan/fridge-ai#installation' },
    },
  },
  faq: [
    {
      question: 'Is it really free?',
      answer:
        'Yes. The code is MIT-licensed and self-hosting is fully featured, AI included: bring your own Gemini or OpenAI key, or run a local model. Nothing is held back for a paid tier.',
    },
    {
      question: 'What if I don’t want to run a server?',
      answer:
        'A hosted plan is in the works: free for the essentials, with a €2/month subscription for the AI features (receipt scanning, recipes). It isn’t open yet.',
    },
    {
      question: 'Does my data go anywhere else?',
      answer:
        'The app only talks to your server. It’s the one querying OpenFoodFacts or the AI provider you picked — and with Ollama, nothing leaves your home.',
    },
    {
      question: 'Can several people use it?',
      answer:
        'That’s the whole idea: one household, several members, one shared pantry. Join a household with its invite code.',
    },
    {
      question: 'How do I sign in?',
      answer:
        'With email and password, or through your own PocketID instance. Password login can be turned off to use PocketID only.',
    },
    {
      question: 'What devices does it run on?',
      answer:
        'iOS and Android. The app isn’t on the stores yet: in the meantime, it runs from the repo in Expo Go, pointed at your server.',
    },
  ],
  stores: { appStore: null, playStore: null },
  ui: {
    skipToContent: 'Skip to content',
    nav: { features: 'Features', start: 'Get started', faq: 'FAQ' },
    cta: { start: 'Get started', viewOnGithub: 'View on GitHub' },
    featuresHeading: 'Features',
    starsSuffix: 'stars on GitHub',
    stats: {
      heading: 'Already in kitchens',
      subtitle: 'Live numbers from the hosted instance and the repository.',
      households: 'Households',
      productsConsumed: 'Products consumed',
      recipesGenerated: 'AI-suggested recipes',
      starsOnGithub: 'stars on GitHub',
      version: 'Version',
      license: 'License',
    },
    offers: {
      or: 'or',
      storesAvailable: 'App Store and Google Play',
      storesFallback: 'iOS and Android · coming soon to the stores',
    },
    faq: {
      headingBefore: 'Got',
      headingHighlight: 'questions',
      headingAfter: ' ?',
      subtitle: 'Hosting, AI, data: what people ask before getting started.',
      askYours: 'Ask yours',
    },
    footer: {
      taglineBefore: 'Nothing gets lost ',
      taglineHighlight: 'in the back of the fridge',
      taglineAfter: ' again.',
      navLabel: 'Footer',
      navApp: 'The app',
      navProject: 'The project',
      links: {
        features: 'Features',
        start: 'Two ways to get started',
        faq: 'Frequently asked questions',
        github: 'GitHub',
        selfHost: 'Self-hosting',
        license: 'MIT License',
        issues: 'Report an issue',
      },
      credit: 'Garde-manger · open source, MIT licensed',
      illustrationCredit: 'Illustrations: Fluent Emoji © Microsoft, MIT licensed.',
    },
  },
}
