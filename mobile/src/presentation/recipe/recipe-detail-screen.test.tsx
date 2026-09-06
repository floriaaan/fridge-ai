import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { RecipeDetailScreen } from './recipe-detail-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

function renderRecipe(recipeId: string, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeDetailScreen recipeId={recipeId} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test('shows the recipe with its numbered steps', async () => {
  renderRecipe('fake-recipe-1')

  await waitFor(() => expect(screen.getByText('Poêlée poulet-épinards')).toBeTruthy())
  expect(screen.getByText('Faire revenir le poulet coupé en dés 8 min.')).toBeTruthy()
  expect(screen.getByText('20 min')).toBeTruthy()
})

test('separates what the foyer already owns from what it has to buy', async () => {
  // No AI latency: this test wants the generated recipe's shape, not the wait.
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  // A generated recipe is the case where the backend links ingredients to
  // real products; the seeded fixtures carry none.
  await connector.generateRecipes()
  const [generated] = await connector.getRecipes()
  renderRecipe(generated.id, connector)

  await waitFor(() => expect(screen.getByTestId('recipe-owned')).toBeTruthy())
  expect(screen.queryByTestId('recipe-missing')).toBeNull()
  expect(screen.getByText('Tu as tout ce qu’il faut.')).toBeTruthy()
})

test('missing ingredients can be pushed onto the shopping list in one tap', async () => {
  const connector = new FakeFridgeConnector()
  renderRecipe('fake-recipe-1', connector)

  await waitFor(() => expect(screen.getByTestId('recipe-add-missing')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipe-add-missing'))

  await waitFor(async () => {
    const items = await connector.getShoppingItems()
    expect(items.map((i) => i.name)).toEqual(expect.arrayContaining(['Filet de poulet', 'Épinards frais', 'Riz basmati']))
  })
})

test('an unknown recipe says so instead of rendering a blank screen', async () => {
  renderRecipe('nope')

  await waitFor(() => expect(screen.getByText('Recette introuvable.')).toBeTruthy())
})
