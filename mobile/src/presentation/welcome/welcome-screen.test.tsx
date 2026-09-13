// mobile/src/presentation/welcome/welcome-screen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { WelcomeScreen } from './welcome-screen.js'

// `render` (RTL 14) is async — every caller must await it, or `screen`
// queries run before `setRenderResult` lands and throw "`render` function
// has not been called" regardless of what actually mounted.
async function renderWelcome() {
  const onDone = jest.fn()
  await render(
    <ThemeProvider>
      <WelcomeScreen onDone={onDone} />
    </ThemeProvider>,
  )
  return { onDone }
}

test('opens on the first page', async () => {
  await renderWelcome()
  expect(screen.getByText('Ton frigo, d’un coup d’œil')).toBeTruthy()
})

test('"Passer" finishes from any page, including the first', async () => {
  const { onDone } = await renderWelcome()

  await fireEvent.press(screen.getByTestId('welcome-skip'))

  expect(onDone).toHaveBeenCalledTimes(1)
})

test('"Continuer" steps through all three pages, then "Commencer" finishes', async () => {
  const { onDone } = await renderWelcome()
  const button = screen.getByTestId('welcome-continue')

  expect(screen.getByText('Continuer')).toBeTruthy()
  await fireEvent.press(button) // page 1 -> 2
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.getByText('Scanne, c’est rangé')).toBeTruthy()

  await fireEvent.press(button) // page 2 -> 3
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.getByText('Le foyer partage la même étagère')).toBeTruthy()
  expect(screen.getByText('Commencer')).toBeTruthy()

  await fireEvent.press(button) // page 3 -> done, same destination as "Passer"
  expect(onDone).toHaveBeenCalledTimes(1)
})
