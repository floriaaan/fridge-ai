/**
 * The Recettes composer's one piece of logic: turn what the cook picked into
 * the single free-text `prompt` that `POST /api/recipes/generate` accepts.
 *
 * The endpoint takes a string and nothing else — there is no structured
 * constraint field to fill — so the chips are a vocabulary for writing that
 * string, not a second API. Keeping the composition here (pure, no React)
 * means the wording the model actually receives is readable and testable in
 * one place instead of being assembled inside a press handler.
 *
 * Every group is optional, including all of them at once: an untouched form
 * generates exactly as the button did before the composer existed.
 */

export interface RecipeOption {
  id: string
  label: string
  /** The clause this option contributes to the sentence, in the app's own French. */
  clause: string
}

export interface RecipeOptionGroup {
  id: string
  label: string
  /** Key into `GROUP_ICONS` — one glyph per group, because six groups ask six different questions. */
  icon: 'repas' | 'temps' | 'regime' | 'cuisine' | 'enCuisine' | 'portions'
  /** `single` groups behave like a radio that can be un-picked; `multi` groups stack. */
  mode: 'single' | 'multi'
  options: readonly RecipeOption[]
}

export const RECIPE_OPTION_GROUPS: readonly RecipeOptionGroup[] = [
  {
    id: 'repas',
    icon: 'repas',
    label: 'Type de repas',
    mode: 'single',
    options: [
      { id: 'petit-dejeuner', label: 'Petit-déjeuner', clause: 'pour le petit-déjeuner' },
      { id: 'dejeuner', label: 'Déjeuner', clause: 'pour le déjeuner' },
      { id: 'diner', label: 'Dîner', clause: 'pour le dîner' },
      { id: 'apero', label: 'Apéro', clause: 'à servir à l’apéro' },
      { id: 'dessert', label: 'Dessert', clause: 'en dessert' },
    ],
  },
  {
    id: 'temps',
    icon: 'temps',
    label: 'Temps en cuisine',
    mode: 'single',
    options: [
      { id: 'express', label: '15 min', clause: 'prête en moins de 15 minutes' },
      { id: 'court', label: '30 min', clause: 'prête en moins de 30 minutes' },
      { id: 'mijote', label: 'On a le temps', clause: 'qui peut mijoter longuement' },
    ],
  },
  {
    id: 'regime',
    icon: 'regime',
    label: 'Régime',
    mode: 'multi',
    options: [
      { id: 'vegetarien', label: 'Végétarien', clause: 'végétarienne' },
      { id: 'vegan', label: 'Végan', clause: 'végane' },
      { id: 'sans-gluten', label: 'Sans gluten', clause: 'sans gluten' },
      { id: 'sans-lactose', label: 'Sans lactose', clause: 'sans lactose' },
    ],
  },
  {
    id: 'cuisine',
    icon: 'cuisine',
    label: 'Envie d’ailleurs',
    mode: 'single',
    options: [
      { id: 'italien', label: 'Italien', clause: 'd’inspiration italienne' },
      { id: 'asiatique', label: 'Asiatique', clause: 'd’inspiration asiatique' },
      { id: 'oriental', label: 'Oriental', clause: 'd’inspiration orientale' },
      { id: 'terroir', label: 'Terroir', clause: 'de cuisine française traditionnelle' },
    ],
  },
  {
    id: 'materiel',
    icon: 'enCuisine',
    label: 'En cuisine',
    mode: 'multi',
    options: [
      { id: 'sans-four', label: 'Sans four', clause: 'sans four' },
      { id: 'un-plat', label: 'Un seul plat', clause: 'en un seul plat' },
      { id: 'sans-robot', label: 'Sans robot', clause: 'sans robot de cuisine' },
      { id: 'enfants', label: 'Pour les enfants', clause: 'que des enfants mangeront' },
    ],
  },
  {
    id: 'portions',
    icon: 'portions',
    label: 'Portions',
    mode: 'single',
    options: [
      { id: '1', label: 'Pour 1', clause: 'pour 1 personne' },
      { id: '2', label: 'Pour 2', clause: 'pour 2 personnes' },
      { id: '4', label: 'Pour 4', clause: 'pour 4 personnes' },
      { id: '6', label: 'Pour 6', clause: 'pour 6 personnes' },
    ],
  },
]

/** Selections keyed by group id — a `single` group holds at most one id. */
export type RecipeSelections = Readonly<Record<string, readonly string[]>>

export interface RecipeWish {
  /** What the cook typed, verbatim. Leads the sentence — it is the most specific thing said. */
  freeText: string
  /** Ingredients or flavours to keep out. Becomes a "sans …" clause at the end. */
  avoid: string
  selections: RecipeSelections
  /**
   * Products the cook pinned from their own garde-manger, by name. The one
   * control in this composer that no generic recipe app can offer: every other
   * group here (meal, time, diet, cuisine) ships in every competitor, and none
   * of them knows what is actually in your kitchen tonight.
   */
  pinned: readonly string[]
}

export const EMPTY_WISH: RecipeWish = { freeText: '', avoid: '', selections: {}, pinned: [] }

export function isPinned(wish: RecipeWish, name: string): boolean {
  return wish.pinned.includes(name)
}

export function togglePinned(wish: RecipeWish, name: string): RecipeWish {
  return {
    ...wish,
    pinned: wish.pinned.includes(name) ? wish.pinned.filter((pin) => pin !== name) : [...wish.pinned, name],
  }
}

export function isSelected(wish: RecipeWish, groupId: string, optionId: string): boolean {
  return (wish.selections[groupId] ?? []).includes(optionId)
}

/** Toggling respects the group's own mode: `single` swaps, `multi` accumulates, both un-pick. */
export function toggleOption(wish: RecipeWish, group: RecipeOptionGroup, optionId: string): RecipeWish {
  const current = wish.selections[group.id] ?? []
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : group.mode === 'single'
      ? [optionId]
      : [...current, optionId]
  return { ...wish, selections: { ...wish.selections, [group.id]: next } }
}

export function countSelections(wish: RecipeWish): number {
  return Object.values(wish.selections).reduce((total, ids) => total + ids.length, 0)
}

export function isWishEmpty(wish: RecipeWish): boolean {
  return (
    wish.freeText.trim().length === 0 &&
    wish.avoid.trim().length === 0 &&
    wish.pinned.length === 0 &&
    countSelections(wish) === 0
  )
}

function clausesOf(wish: RecipeWish): string[] {
  const clauses: string[] = []
  // First, because it is the most concrete thing the cook can ask for and the
  // only clause drawn from their own shelves.
  if (wish.pinned.length > 0) clauses.push(`en utilisant ${joinFr(wish.pinned)}`)
  for (const group of RECIPE_OPTION_GROUPS) {
    for (const option of group.options) {
      if (isSelected(wish, group.id, option.id)) clauses.push(option.clause)
    }
  }
  const avoid = wish.avoid.trim()
  if (avoid) clauses.push(`sans ${avoid}`)
  return clauses
}

/**
 * `undefined` when nothing was asked for — the app then generates exactly as
 * it did before the composer existed, which is the common case and must stay
 * one tap away.
 */
export function composeRecipePrompt(wish: RecipeWish): string | undefined {
  const typed = wish.freeText.trim()
  const clauses = clausesOf(wish)

  if (!typed && clauses.length === 0) return undefined
  if (!typed) return `Une recette ${clauses.join(', ')}.`
  if (clauses.length === 0) return typed
  return `${typed} — ${clauses.join(', ')}.`
}

/** "yaourt, épinards et crème" — a list a person reads, not a joined array. */
export function joinFr(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

/** A one-line recap of everything the wish is holding. */
export function describeWish(wish: RecipeWish): string | null {
  const parts: string[] = []
  const typed = wish.freeText.trim()
  if (typed) parts.push(typed)
  if (wish.pinned.length > 0) parts.push(joinFr(wish.pinned))
  for (const group of RECIPE_OPTION_GROUPS) {
    for (const option of group.options) {
      if (isSelected(wish, group.id, option.id)) parts.push(option.label)
    }
  }
  const avoid = wish.avoid.trim()
  if (avoid) parts.push(`sans ${avoid}`)
  return parts.length > 0 ? parts.join(' · ') : null
}
