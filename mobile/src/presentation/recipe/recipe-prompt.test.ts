import {
  composeRecipePrompt,
  countSelections,
  describeWish,
  EMPTY_WISH,
  isSelected,
  isPinned,
  isWishEmpty,
  RECIPE_OPTION_GROUPS,
  toggleOption,
  togglePinned,
  type RecipeWish,
} from './recipe-prompt.js'

function group(id: string) {
  const found = RECIPE_OPTION_GROUPS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no such group: ${id}`)
  return found
}

function wishWith(...picks: [string, string][]): RecipeWish {
  return picks.reduce<RecipeWish>((wish, [groupId, optionId]) => toggleOption(wish, group(groupId), optionId), EMPTY_WISH)
}

test('an untouched form sends no prompt at all — generating stays unconstrained', () => {
  expect(isWishEmpty(EMPTY_WISH)).toBe(true)
  expect(composeRecipePrompt(EMPTY_WISH)).toBeUndefined()
})

test('typed text is sent verbatim when it is the only thing said', () => {
  expect(composeRecipePrompt({ ...EMPTY_WISH, freeText: '  un gratin  ' })).toBe('un gratin')
})

test('a single-choice group swaps rather than stacks', () => {
  const wish = wishWith(['portions', '2'], ['portions', '4'])

  expect(isSelected(wish, 'portions', '2')).toBe(false)
  expect(isSelected(wish, 'portions', '4')).toBe(true)
  expect(countSelections(wish)).toBe(1)
})

test('a multi-choice group stacks, and picking twice un-picks', () => {
  const stacked = wishWith(['regime', 'vegetarien'], ['regime', 'sans-gluten'])
  expect(countSelections(stacked)).toBe(2)

  const undone = toggleOption(stacked, group('regime'), 'sans-gluten')
  expect(isSelected(undone, 'regime', 'sans-gluten')).toBe(false)
})

test('chips alone become a sentence, always in group order rather than pick order', () => {
  const wish = wishWith(['portions', '4'], ['regime', 'vegetarien'], ['temps', 'express'])

  expect(composeRecipePrompt(wish)).toBe(
    'Une recette prête en moins de 15 minutes, végétarienne, pour 4 personnes.',
  )
})

test('typed text leads and the chips qualify it, with the exclusion last', () => {
  const wish = { ...wishWith(['materiel', 'sans-four']), freeText: 'un gratin', avoid: 'champignons' }

  expect(composeRecipePrompt(wish)).toBe('un gratin — sans four, sans champignons.')
})

test('an exclusion on its own is still a prompt', () => {
  expect(composeRecipePrompt({ ...EMPTY_WISH, avoid: 'piment' })).toBe('Une recette sans piment.')
  expect(isWishEmpty({ ...EMPTY_WISH, avoid: 'piment' })).toBe(false)
})

test('the recap names what is set, in the app’s own words', () => {
  const wish = { ...wishWith(['temps', 'express']), freeText: 'un gratin', avoid: 'piment' }

  expect(describeWish(wish)).toBe('un gratin · 15 min · sans piment')
  expect(describeWish(EMPTY_WISH)).toBeNull()
})

test('a pinned product leads the clauses — it is the most concrete thing a cook can ask for', () => {
  const wish = togglePinned(togglePinned(EMPTY_WISH, 'yaourt'), 'épinards')

  expect(isPinned(wish, 'yaourt')).toBe(true)
  expect(isWishEmpty(wish)).toBe(false)
  expect(composeRecipePrompt(wish)).toBe('Une recette en utilisant yaourt et épinards.')
})

test('pinning the same product twice un-pins it', () => {
  expect(togglePinned(togglePinned(EMPTY_WISH, 'yaourt'), 'yaourt').pinned).toEqual([])
})

test('a pin combines with the chips, and still leads', () => {
  const wish = { ...togglePinned(wishWith(['temps', 'express']), 'yaourt'), freeText: 'un gratin' }

  expect(composeRecipePrompt(wish)).toBe('un gratin — en utilisant yaourt, prête en moins de 15 minutes.')
})
