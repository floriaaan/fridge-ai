// mobile/src/presentation/welcome/use-welcome-seen.test.ts
import { renderHook, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { markWelcomeSeen, useHasSeenWelcome } from './use-welcome-seen.js'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

afterEach(() => {
  jest.clearAllMocks()
})

test('useHasSeenWelcome() resolves false on a device that has never answered', async () => {
  ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)

  const { result } = await renderHook(() => useHasSeenWelcome())

  await waitFor(() => expect(result.current).toBe(false))
})

test('useHasSeenWelcome() resolves true once markWelcomeSeen() has written the flag', async () => {
  let stored: string | null = null
  ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async () => stored)
  ;(SecureStore.setItemAsync as jest.Mock).mockImplementation(async (_key: string, value: string) => {
    stored = value
  })

  await markWelcomeSeen()

  const { result } = await renderHook(() => useHasSeenWelcome())
  await waitFor(() => expect(result.current).toBe(true))

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('garde-manger.welcome.seen', '1')
})
