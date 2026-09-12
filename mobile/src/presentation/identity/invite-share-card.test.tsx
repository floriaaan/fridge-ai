// mobile/src/presentation/identity/invite-share-card.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { ThemeProvider } from '../shared/theme-provider.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { InviteShareCard } from './invite-share-card.js'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
// `showQr` defaults to `false` so this never actually renders, but the
// import itself still runs at module-load time — `react-native-qrcode-svg`
// draws through `react-native-svg`, which jest can't resolve without a
// mock, same convention as `CameraView` in barcode-scanner-screen.test.tsx.
jest.mock('react-native-qrcode-svg', () => 'QRCode')

function Harness({ onFeedback }: { onFeedback: (message: string) => void }) {
  const palette = useSoftPalette()
  return (
    <InviteShareCard
      householdName="Le foyer de Florian"
      inviteCode="ABCD1234"
      palette={palette}
      regenerating={false}
      onRegenerate={jest.fn()}
      onFeedback={onFeedback}
    />
  )
}

afterEach(() => {
  jest.clearAllMocks()
})

test('a share-sheet failure records telemetry and shows the failure hint', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('sheet unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  const onFeedback = jest.fn()

  render(
    <ThemeProvider>
      <Harness onFeedback={onFeedback} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId('household-invite-share'))

  await waitFor(() => expect(onFeedback).toHaveBeenCalledWith('Le partage n’a pas pu s’ouvrir.'))
  expect(spy).toHaveBeenCalledWith(
    'share sheet failed to open',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.share_invite' } }),
  )
  spy.mockRestore()
})

test('a clipboard write failure records telemetry and shows the failure hint', async () => {
  ;(Clipboard.setStringAsync as jest.Mock).mockRejectedValue(new Error('clipboard unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  const onFeedback = jest.fn()

  render(
    <ThemeProvider>
      <Harness onFeedback={onFeedback} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId('household-invite-copy'))

  await waitFor(() => expect(onFeedback).toHaveBeenCalledWith('Impossible de copier le code.'))
  expect(spy).toHaveBeenCalledWith(
    'clipboard write failed',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.copy_invite' } }),
  )
  spy.mockRestore()
})
