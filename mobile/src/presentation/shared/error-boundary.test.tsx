import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ThemeProvider } from './theme-provider.js'
import { ErrorBoundary } from './error-boundary.js'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../../application/shared/telemetry.js'

// Same wiring as `app-storage.test.ts`: `configureTelemetry` is what
// `providers/wire-telemetry.ts` does for the real app, so `jest.spyOn`
// below spies on the instance `getTelemetry()` actually returns.
configureTelemetry(telemetry)

afterEach(() => {
  jest.clearAllMocks()
})

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <Text>alive</Text>
}

// Jest logs React's own "The above error occurred" console.error for every
// thrown-during-render test — expected noise, silenced so it doesn't read
// as a test failure.
let consoleErrorSpy: jest.SpyInstance
beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

test('renders children normally when nothing throws', async () => {
  await render(
    <ThemeProvider>
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    </ThemeProvider>,
  )

  expect(screen.getByText('alive')).toBeTruthy()
})

test('a thrown render error shows the friendly fallback instead of the crash — and reports it', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await render(
    <ThemeProvider>
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    </ThemeProvider>,
  )

  expect(screen.getByText('Oups, un problème est survenu.')).toBeTruthy()
  expect(screen.queryByText('alive')).toBeNull()
  expect(spy).toHaveBeenCalledWith('unhandled render error', expect.objectContaining({ error: expect.any(Error) }))
  spy.mockRestore()
})

test('"Réessayer" re-renders the children instead of staying stuck on the fallback', async () => {
  let shouldThrow = true
  function FlakyBomb() {
    return <Bomb shouldThrow={shouldThrow} />
  }

  await render(
    <ThemeProvider>
      <ErrorBoundary>
        <FlakyBomb />
      </ErrorBoundary>
    </ThemeProvider>,
  )

  expect(screen.getByText('Oups, un problème est survenu.')).toBeTruthy()

  // The retry itself doesn't fix the underlying cause — same as a real
  // "server came back" scenario, the condition that crashed it needs to
  // have changed by the time the boundary re-renders its children.
  shouldThrow = false
  fireEvent.press(screen.getByText('Réessayer'))

  expect(await screen.findByText('alive')).toBeTruthy()
})
