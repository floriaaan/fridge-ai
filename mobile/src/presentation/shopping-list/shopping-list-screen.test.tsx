import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ShoppingListScreen } from './shopping-list-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
 useFocusEffect: jest.fn(),
}))

// AppShell always wires this screen's `refresh` binding into a real
// react-native `RefreshControl` on its ScrollView (see app-shell.tsx +
// pull-to-refresh.tsx) — every test in this file already renders one, just
// with nothing to grab it by. @testing-library/react-native v14 dropped
// UNSAFE_getByType/UNSAFE_getByProps (see barcode-scanner-screen.test.tsx's
// note on the same gap), so there is no type- or prop-based query left to
// reach it. Unlike that file — whose `testID` is already on the real
// component in production and its mock only avoids rendering the native
// camera module — `RefreshControl` carries no testID in source, so this
// mock stamps one onto a wrapper that forwards every other prop straight
// through. Scoped to this file only (Jest mocks don't leak across files):
// how the pull-to-refresh tests below fire the gesture and read back what
// ran.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  // `jest.mock()` factories may not reference any out-of-scope variable, so
  // `React.createElement` is required here rather than imported at the top
  // of the file — a module-level `import` would be exactly such a reference.
  const { createElement } = require('react')
  // A `Proxy`, not a `{...actual}` spread: spreading forces every one of RN's
  // exports to be read eagerly at mock-factory time (most are enumerable
  // getters for interop), and one of those getters reaches for a native
  // module (`DevMenu`, via `virtualized-lists` → `expo-modules-core`) that
  // doesn't exist in this test environment — `TurboModuleRegistry.getEnforcing`
  // throws before a single test runs. A `Proxy` only touches the one property
  // this mock actually overrides; everything else stays lazily forwarded to
  // the real module exactly as an unmocked `require('react-native')` would.
  // `createElement` is React's, not react-native's — `actual` (the real
  // `react-native` module) has no such export. Named, not inline: an
  // anonymous component here trips `react/display-name`.
  function MockRefreshControl(props: Record<string, unknown>) {
    return createElement('RefreshControl', { testID: 'shopping-list-refresh-control', ...props })
  }
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'RefreshControl') return MockRefreshControl
      return Reflect.get(target, prop, receiver)
    },
  })
})

function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

afterEach(() => jest.clearAllMocks())

test('tapping "+ Ajouter" navigates to the new-item route', async () => {
  await renderScreen()
  await fireEvent.press(screen.getByTestId('shopping-list-add'))
  expect(router.push).toHaveBeenCalledWith('/(tabs)/shopping-list/new')
})

// The row's swipe actions are hidden from the accessibility tree (and thus
// from RNTL's default queries) while the swipe is closed — see shopping-row.tsx's
// `accessibilityElementsHidden`/`importantForAccessibility` wiring, spec §3's
// "swipe is the intent-confirmation step". These tests exercise the handler
// wiring directly rather than performing the swipe gesture itself, so they
// need `includeHiddenElements: true` to reach the (currently hidden) buttons.

test("tapping the row's Modifier action navigates to the item's edit route", async () => {
  await renderScreen()
  const editButtons = await screen.findAllByTestId(/^shopping-row-edit-/, { includeHiddenElements: true })
  await fireEvent.press(editButtons[0])
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/shopping-list/[id]/edit' }))
})

test("the row's Supprimer action deletes right away, no confirmation step", async () => {
  const connector = new FakeFridgeConnector()
  const deleteSpy = jest.spyOn(connector, 'deleteShoppingItem')
  await renderScreen(connector)

  const before = await screen.findAllByTestId(/^shopping-row-delete-/, { includeHiddenElements: true })
  const targetTestId = before[0].props.testID as string
  await fireEvent.press(before[0])

  // The swipe + tap on Supprimer is itself the deliberate step — no sheet in between.
  expect(screen.queryByTestId('shopping-list-delete-confirm')).toBeNull()
  await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByTestId(targetTestId, { includeHiddenElements: true })).toBeNull())
})

test('a long press opens the same actions as the swipe, for anyone who cannot swipe', async () => {
  await renderScreen()

  const rows = await screen.findAllByTestId(/^shopping-row-fake-item-/)
  await fireEvent(rows[0], 'longPress')

  expect(screen.getByTestId('shopping-list-edit-confirm')).toBeTruthy()
  expect(screen.getByTestId('shopping-list-delete-confirm')).toBeTruthy()
})

test('a failed delete shows a hint instead of removing the row', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'deleteShoppingItem').mockResolvedValue({ ok: false, error: { type: 'server_error', message: 'Suppression impossible.' } })
  await renderScreen(connector)

  const deleteButtons = await screen.findAllByTestId(/^shopping-row-delete-/, { includeHiddenElements: true })
  const targetTestId = deleteButtons[0].props.testID as string
  await fireEvent.press(deleteButtons[0])

  await waitFor(() => expect(screen.getByText('Suppression impossible.')).toBeTruthy())
  expect(screen.queryByTestId(targetTestId, { includeHiddenElements: true })).toBeTruthy()
})

test('an empty list hands over the next action', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getShoppingItems').mockResolvedValue([])
  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('shopping-list-empty-add')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('shopping-list-empty-add'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/shopping-list/new')
})

test('pull-to-refresh syncs with Home Assistant before reloading the list', async () => {
  const connector = new FakeFridgeConnector()
  const syncSpy = jest.spyOn(connector, 'syncShoppingListWithHa')
  await renderScreen(connector)

  const refreshControl = await screen.findByTestId('shopping-list-refresh-control')
  await act(async () => {
    refreshControl.props.onRefresh()
  })

  await waitFor(() => expect(syncSpy).toHaveBeenCalled())
})

test('a sync failure does not block the list from reloading', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'syncShoppingListWithHa').mockResolvedValue({
    ok: false,
    error: { type: 'unreachable', message: 'Impossible de joindre cette adresse depuis le serveur.' },
  })
  await renderScreen(connector)

  const refreshControl = await screen.findByTestId('shopping-list-refresh-control')
  await act(async () => {
    refreshControl.props.onRefresh()
  })

  await waitFor(() => expect(screen.getAllByTestId(/^shopping-row-fake-item-/).length).toBeGreaterThan(0))
})
