import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../../application/shared/telemetry.js'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ThresholdScreen } from './threshold-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
}))

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
}))

jest.mock('expo-linking', () => ({ createURL: (path: string) => `fridgeai://${path}` }))

// The keychain has no implementation under jest, and entering a foyer writes
// to it (arming the dashboard's tour). Left unmocked, that write stays pending
// past the end of the test and the next render never commits.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

// `threshold-screen.tsx` reaches telemetry through `getTelemetry()` (the
// boundary lint forbids importing `infrastructure/telemetry` from
// presentation) — wiring the real singleton in here mirrors what
// `providers/wire-telemetry.ts` does for the app itself.
configureTelemetry(telemetry)

async function renderThreshold(overrides: { prefillCode?: string | null } = {}) {
  const connector = new FakeFridgeConnector()
  // Signing up is what leaves an account with no foyer — the state this whole
  // screen exists for, and the same path a real new account takes.
  await connector.signUpEmail('nouveau@exemple.com', 'motdepasse', 'Florian')
  const onEnteredHousehold = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ThresholdScreen
            userName="Florian"
            prefillCode={overrides.prefillCode ?? null}
            onEnteredHousehold={onEnteredHousehold}
            onScanCode={jest.fn()}
            onSignedOut={jest.fn()}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  // The first query is always awaited: this root commits asynchronously, so a
  // synchronous `getByTestId` right after `render` races the first paint.
  await waitFor(() => expect(screen.getByTestId('threshold-create-card')).toBeTruthy())
  return { connector, onEnteredHousehold }
}

test('a clipboard read failure records telemetry and shows the empty-clipboard hint', async () => {
  ;(Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await renderThreshold()
  fireEvent.press(screen.getByTestId('threshold-paste'))

  await waitFor(() =>
    expect(spy).toHaveBeenCalledWith(
      'clipboard read failed',
      expect.objectContaining({ attributes: { 'app.operation': 'identity.paste_invite' } }),
    ),
  )
  spy.mockRestore()
})

test('both branches are on one screen — no button that opens a second one', async () => {
  await renderThreshold()

  // The eight cells are on the join card itself, which is the whole reason the
  // lighter branch loses nothing by being the lighter branch.
  expect(screen.getByTestId('threshold-join-card')).toBeTruthy()
  expect(screen.getByTestId('threshold-invite-code')).toBeTruthy()
})

test('neither action is answerable until its field is', async () => {
  await renderThreshold()

  expect(screen.getByTestId('threshold-create-submit')).toBeDisabled()
  expect(screen.getByTestId('threshold-join-submit')).toBeDisabled()
})

test('naming a foyer creates it and hands the account over to the gate', async () => {
  const { connector, onEnteredHousehold } = await renderThreshold()
  const createSpy = jest.spyOn(connector, 'createHousehold')

  fireEvent.changeText(screen.getByTestId('threshold-household-name'), 'Coloc du 3e')
  await waitFor(() => expect(screen.getByTestId('threshold-create-submit')).not.toBeDisabled())
  fireEvent.press(screen.getByTestId('threshold-create-submit'))

  await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Coloc du 3e'))
  await waitFor(() => expect(onEnteredHousehold).toHaveBeenCalled())
})

test('a code arriving whole from a deep link fills the field and arms the button', async () => {
  await renderThreshold({ prefillCode: 'K4Q2M7XP' })

  await waitFor(() => expect(screen.getByTestId('threshold-invite-code').props.value).toBe('K4Q2M7XP'))
  expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled()
})

test('a lowercase code typed one-handed is the same code', async () => {
  await renderThreshold()

  fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'k4q2m7xp')

  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
})

test('joining with the real code enters the foyer', async () => {
  const { connector, onEnteredHousehold } = await renderThreshold()
  const joinSpy = jest.spyOn(connector, 'joinHousehold')

  fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'K4Q2M7XP')
  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
  fireEvent.press(screen.getByTestId('threshold-join-submit'))

  await waitFor(() => expect(joinSpy).toHaveBeenCalledWith('K4Q2M7XP'))
  await waitFor(() => expect(onEnteredHousehold).toHaveBeenCalled())
})

test('the mandatory step is not a trap — there is always a way back to sign-in', async () => {
  await renderThreshold()

  expect(screen.getByTestId('threshold-sign-out')).toBeTruthy()
})

// Last on purpose: this is the only case that leaves a settled failed mutation
// behind, and under this jest/React setup the next `render` in the file then
// never commits. A harness ordering fragility, not a product one — the same
// assertions pass in any position when they run first.
test('a rejected code is said on the field, and the foyer name is not lost with it', async () => {
  await renderThreshold()

  fireEvent.changeText(screen.getByTestId('threshold-household-name'), 'Coloc du 3e')
  fireEvent.changeText(screen.getByTestId('threshold-invite-code'), 'AAAA1111')
  await waitFor(() => expect(screen.getByTestId('threshold-join-submit')).not.toBeDisabled())
  fireEvent.press(screen.getByTestId('threshold-join-submit'))

  // Matched without the apostrophe on purpose: the message is the server's own
  // (`error-serializer.ts`), and it uses a straight quote where this app's copy
  // uses a curly one.
  await waitFor(() => expect(screen.getByText(/invitation invalide/)).toBeTruthy())
  // The other branch is untouched: someone who mistyped a code has not
  // abandoned the name they were considering.
  expect(screen.getByTestId('threshold-household-name').props.value).toBe('Coloc du 3e')
})

