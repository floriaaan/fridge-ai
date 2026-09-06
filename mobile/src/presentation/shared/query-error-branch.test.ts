/**
 * A screen that lists shared household state must have an `isError` branch.
 *
 * This is a source-shape guard, not a behavioural test, and it exists because
 * the same defect shipped four times independently: `ListEmptyComponent`
 * branches on `isPending` then on emptiness, a failed read falls through the
 * gap, and the screen states as fact that the foyer's fridge / history / foyer
 * is empty. On shared state that is not a missing state — it is a confident
 * false claim, made on the screens people open standing in a kitchen on bad
 * wifi, and the recovery each one offers ("scan something") cannot work either.
 *
 * Scoped to the list screens on purpose. A form's prefill lookup or an auth
 * method list failing is a different, smaller problem with a different answer;
 * those are not covered here and are not thereby blessed.
 */
// Declared rather than imported: the mobile package carries no `@types/node`
// (it ships to a device, not to node), and this one source-shape guard is not
// worth adding a toolchain dependency for. `babel-jest` resolves both modules
// at runtime.
declare function require(id: string): unknown
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: string) => string }
const { join } = require('node:path') as { join: (...parts: string[]) => string }
declare const __dirname: string

const SHARED_STATE_LIST_SCREENS = [
  'dashboard/household-dashboard.tsx',
  'fridge/fridge-list-screen.tsx',
  'identity/household-screen.tsx',
  'receipt/receipts-list-screen.tsx',
  'recipe/recipe-list-screen.tsx',
  'shopping-list/shopping-list-screen.tsx',
]

test.each(SHARED_STATE_LIST_SCREENS)('%s reads isError on the state it lists', (relativePath) => {
  const source = readFileSync(join(__dirname, '..', relativePath), 'utf8')

  expect(source).toMatch(/\buse[A-Za-z]*Query\(/)
  expect(source).toMatch(/\.isError\b/)
})
